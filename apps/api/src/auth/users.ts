// 認可（2段目）: 認証済みの Identity を users テーブルへ着地させる。
//
// 認証が通っても、ここに行が無ければ通さない（403）。
// 「D1 に登録されたユーザーしか使えない」を成立させているのはこのファイル。
//
// 紐付けは email ではなく google_sub で行う。email は変わりうるが sub は不変。
// ただし招待の時点では sub を知りようがないため、sub → email(invited) の順で引く。

import type { AuthenticatedUser, Identity, Role } from './types';

/** users.status の取りうる値。D1 の CHECK 制約と同じ集合を型でも持つ。 */
type UserStatus = 'invited' | 'active' | 'disabled';

type UserRow = {
  id: string;
  role: string;
  status: string;
};

const ACTIVE_STATUS: UserStatus = 'active';
const INVITED_STATUS: UserStatus = 'invited';

/** 招待時に埋まらない項目。初回ログインで判明した値を後から書き込む。 */
type ProfileFields = {
  /** Google 経路でのみ判明する。他の経路では null。 */
  googleSub: string | null;
  displayName: string | null;
};

const USER_COLUMNS = 'id, role, status';

const isRole = (value: string): value is Role => value === 'admin' || value === 'member';

const toAuthenticatedUser = (row: UserRow): AuthenticatedUser | null => {
  if (!isRole(row.role)) {
    console.warn('[auth] users.role が不正な値のため認可を拒否しました');
    return null;
  }
  return { id: row.id, role: row.role };
};

const queryUser = async (
  database: D1Database,
  sql: string,
  binding: string,
): Promise<UserRow | null> => {
  try {
    return await database.prepare(sql).bind(binding).first<UserRow>();
  } catch (error) {
    throw new Error(
      `users の照会に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
};

const findByGoogleSub = (database: D1Database, googleSub: string): Promise<UserRow | null> =>
  queryUser(database, `SELECT ${USER_COLUMNS} FROM users WHERE google_sub = ?`, googleSub);

const findByEmail = (database: D1Database, email: string): Promise<UserRow | null> =>
  queryUser(database, `SELECT ${USER_COLUMNS} FROM users WHERE email = ?`, email);

/** 招待済みの行を有効化する。google_sub は Google 経路でのみ書き込む。 */
const activate = async (
  database: D1Database,
  userId: string,
  profile: ProfileFields,
): Promise<void> => {
  const now = new Date().toISOString();
  try {
    await database
      .prepare(
        `UPDATE users
         SET status = ?,
             google_sub = COALESCE(?, google_sub),
             display_name = COALESCE(display_name, ?),
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(ACTIVE_STATUS, profile.googleSub, profile.displayName, now, userId)
      .run();
  } catch (error) {
    throw new Error(
      `users の有効化に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
};

/**
 * 空のままの項目を Identity の値で埋める。
 *
 * 有効化は invited のときしか走らないため、これが無いと
 * **すでに active の行は google_sub も display_name も永久に NULL のまま**になる。
 * 既存の値は上書きしない（COALESCE の順序が activate と逆なのはそのため）。
 *
 * 認証の成否には影響させない。失敗しても警告だけ出して通す。
 */
const fillMissingProfile = async (
  database: D1Database,
  userId: string,
  profile: ProfileFields,
): Promise<void> => {
  if (profile.googleSub === null && profile.displayName === null) {
    return;
  }
  try {
    await database
      .prepare(
        `UPDATE users
         SET google_sub = COALESCE(google_sub, ?),
             display_name = COALESCE(display_name, ?),
             updated_at = ?
         WHERE id = ? AND (google_sub IS NULL OR display_name IS NULL)`,
      )
      .bind(profile.googleSub, profile.displayName, new Date().toISOString(), userId)
      .run();
  } catch (error) {
    console.warn('[auth] users の補完に失敗', error instanceof Error ? error.message : '');
  }
};

/**
 * 招待済み（invited）なら有効化して通す。それ以外は active のときだけ通す。
 * disabled は常に拒否する（行を消さずに止められる）。
 */
const acceptOrActivate = async (
  database: D1Database,
  row: UserRow | null,
  profile: ProfileFields,
): Promise<AuthenticatedUser | null> => {
  if (!row) {
    return null;
  }
  if (row.status === ACTIVE_STATUS) {
    const user = toAuthenticatedUser(row);
    if (user) {
      await fillMissingProfile(database, row.id, profile);
    }
    return user;
  }
  if (row.status === INVITED_STATUS) {
    const user = toAuthenticatedUser(row);
    if (!user) {
      return null;
    }
    await activate(database, row.id, profile);
    return user;
  }
  return null;
};

/**
 * Identity を認可済みユーザーへ解決する。解決できなければ null（呼び出し側が 403）。
 * 経路ごとに違うのは引き方だけで、返す形はどの経路でも同じ。
 */
export const resolveUser = async (
  database: D1Database,
  identity: Identity,
): Promise<AuthenticatedUser | null> => {
  if (identity.kind === 'apiToken') {
    // CLI トークンは発行時点で有効なユーザーに紐付いている。招待の有効化経路にはしない。
    const row = await queryUser(
      database,
      `SELECT ${USER_COLUMNS} FROM users WHERE id = ?`,
      identity.userId,
    );
    if (!row || row.status !== ACTIVE_STATUS) {
      return null;
    }
    return toAuthenticatedUser(row);
  }

  if (identity.kind === 'access') {
    const row = await findByEmail(database, identity.email);
    return acceptOrActivate(database, row, { googleSub: null, displayName: null });
  }

  const bySub = await findByGoogleSub(database, identity.googleSub);
  if (bySub) {
    return acceptOrActivate(database, bySub, {
      googleSub: null,
      displayName: identity.displayName,
    });
  }
  const byEmail = await findByEmail(database, identity.email);
  return acceptOrActivate(database, byEmail, {
    googleSub: identity.googleSub,
    displayName: identity.displayName,
  });
};
