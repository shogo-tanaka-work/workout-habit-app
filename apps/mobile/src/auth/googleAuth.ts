// Google サインイン。サーバへ送る ID トークンをここで調達する。
//
// **ID トークンを端末へ保存しない。** 有効期限は1時間しかなく、保存すれば
// 盗まれる場所を増やすだけになる。ログイン状態はネイティブ SDK が保持しており、
// 必要になった時点で signInSilently() から取り直せる。
//
// オフライン優先の切り分け:
//   記録・閲覧・タイマー … トークンが無くても動く
//   同期               … トークンが要る。取れなければ送信を諦めてキューに残す

import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';

// Expo の環境変数は型が付かない（any）ため、ここで文字列へ絞ってから配る。
// **参照は静的に書く。** `process.env[key]` の動的アクセスはビルド時に値へ置換されない。
const asClientId = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

/** Google Cloud で作成した OAuth クライアント ID。値はリポジトリへ書かない。 */
const WEB_CLIENT_ID = asClientId(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
const IOS_CLIENT_ID = asClientId(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);

export type GoogleAccount = {
  email: string;
  displayName: string | null;
};

/** ログインが必要な状態。呼び出し側はサインインを促す。 */
export class SignInRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignInRequiredError';
  }
}

let isConfigured = false;

/**
 * SDK の初期化。webClientId が無いと idToken が返らないため必須扱いにする
 * （設定不足を「トークン無しで通す」に倒さない）。
 */
const ensureConfigured = (): void => {
  if (isConfigured) {
    return;
  }
  if (!WEB_CLIENT_ID) {
    throw new Error(
      'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID が未設定のため Google サインインを使えません',
    );
  }
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    ...(IOS_CLIENT_ID ? { iosClientId: IOS_CLIENT_ID } : {}),
  });
  isConfigured = true;
};

export const isGoogleSignInConfigured = (): boolean => Boolean(WEB_CLIENT_ID);

const toAccount = (user: {
  email: string;
  name?: string | null;
}): GoogleAccount => ({
  email: user.email,
  displayName: user.name ?? null,
});

/** 対話的なサインイン。ユーザーが「ログイン」を押したときだけ呼ぶ。 */
export const signIn = async (): Promise<GoogleAccount | null> => {
  ensureConfigured();
  const response = await GoogleSignin.signIn();
  if (response.type === 'cancelled') {
    return null;
  }
  return toAccount(response.data.user);
};

export const signOut = async (): Promise<void> => {
  ensureConfigured();
  await GoogleSignin.signOut();
};

/** 保存済みのログイン状態から現在のアカウントを返す。未ログインなら null。 */
export const restoreAccount = async (): Promise<GoogleAccount | null> => {
  if (!isGoogleSignInConfigured()) {
    return null;
  }
  ensureConfigured();
  try {
    const response = await GoogleSignin.signInSilently();
    return response.type === 'noSavedCredentialFound' ? null : toAccount(response.data.user);
  } catch (error: unknown) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_REQUIRED) {
      return null;
    }
    console.warn(
      '[auth] ログイン状態の復元に失敗',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
};

/**
 * サーバへ送る ID トークンを取得する。
 * 期限切れは signInSilently() が更新するため、毎回ここを通す。
 * ログインが要る状態なら SignInRequiredError を投げる（送信側はキューに残して諦める）。
 */
export const getIdToken = async (): Promise<string> => {
  ensureConfigured();
  let response;
  try {
    response = await GoogleSignin.signInSilently();
  } catch (error: unknown) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_REQUIRED) {
      throw new SignInRequiredError('Google アカウントでログインしてください');
    }
    throw error;
  }
  if (response.type === 'noSavedCredentialFound') {
    throw new SignInRequiredError('Google アカウントでログインしてください');
  }
  const idToken = response.data.idToken;
  if (!idToken) {
    throw new SignInRequiredError('ID トークンを取得できませんでした。再ログインしてください');
  }
  return idToken;
};
