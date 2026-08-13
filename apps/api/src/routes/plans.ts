// 計画（status='planned'）の取得。Step 5 の Claude Code 連携で使う受信経路。
//
// Claude Code は `POST /sync/operations` で計画を書き込む。書き込み用の API は増やさない。
// この route が受け持つのは「書かれた計画を端末と Claude Code が読む」向きだけ。
//
// **期間内の予定をまるごと返す。** 差分（?since=）にしないのは、削除が物理削除で
// tombstone を持たないため。「期間内の予定を置き換える」形にすれば、
// 消えた予定は返らないという事実がそのまま削除として端末へ伝わる。
//
// 実績（status が active / completed）は返さない。端末の記録を上書きさせないため。

import { Hono } from 'hono';

import { scopeForUser } from '../db/scope';
import type { AppEnv } from '../env';
import type { SyncTable } from '../tables';
import { columnNamesOf, findSyncTable } from '../tables';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 1リクエストで取得できる期間の上限。無指定の巨大レンジで D1 を舐めさせない。 */
const MAX_RANGE_DAYS = 366;

/** IN 句へ並べる ID の数。D1 の1クエリあたりバインド変数上限（100）に収める。 */
const IDS_PER_QUERY = 90;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const PLAN_TABLES = ['workouts', 'workout_exercises', 'workout_sets'] as const;

type PlanTableName = (typeof PLAN_TABLES)[number];

/** 定義が見つからないのは tables.ts との不整合であり、起動時に気付きたい。 */
const planTableOf = (name: PlanTableName): SyncTable => {
  const table = findSyncTable(name);
  if (!table) {
    throw new Error(`sync table not defined: ${name}`);
  }
  return table;
};

const daysBetween = (from: string, to: string): number =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MILLISECONDS_PER_DAY;

export const plans = new Hono<AppEnv>();

plans.get('/', async (context) => {
  const from = context.req.query('from');
  const to = context.req.query('to');

  // 基準日をサーバの UTC 今日で暗黙に決めない（端末ローカル日付とずれるため）。
  // 期間は呼び出し側が必ず明示する。
  if (!from || !ISO_DATE_PATTERN.test(from) || !to || !ISO_DATE_PATTERN.test(to)) {
    return context.json({ error: 'from and to are required (YYYY-MM-DD)' }, 400);
  }
  const span = daysBetween(from, to);
  if (span < 0) {
    return context.json({ error: 'from must not be after to' }, 400);
  }
  if (span > MAX_RANGE_DAYS) {
    return context.json({ error: `range must be within ${MAX_RANGE_DAYS} days` }, 400);
  }

  // **ロールに関わらず本人の予定だけを返す。** admin が全件を見るのは分析 API の役割で、
  // 他人の予定を端末へ取り込ませる経路は作らない（/backup と同じ判断）。
  // 条件は db/scope.ts に集約する（route へ WHERE user_id = ? を書かない）。
  const scope = scopeForUser(context.get('user'), 'user_id');

  const workoutsTable = planTableOf('workouts');
  const workoutRows = (
    await context.env.DB.prepare(
      `SELECT ${columnNamesOf(workoutsTable).join(', ')} FROM workouts
       WHERE ${scope.condition} AND status = 'planned' AND performed_at BETWEEN ? AND ?
       ORDER BY performed_at, created_at`,
    )
      .bind(...scope.params, from, to)
      .all()
  ).results as Record<string, unknown>[];

  const workoutIds = workoutRows.map((row) => String(row.id));
  const exerciseRows = await selectChildren(
    context.env.DB,
    planTableOf('workout_exercises'),
    scope,
    'workout_id',
    workoutIds,
    'ORDER BY order_index',
  );

  const workoutExerciseIds = exerciseRows.map((row) => String(row.id));
  const setRows = await selectChildren(
    context.env.DB,
    planTableOf('workout_sets'),
    scope,
    'workout_exercise_id',
    workoutExerciseIds,
    // 論理削除済みのセットは予定としても存在しない。
    'AND deleted_at IS NULL ORDER BY order_index',
  );

  return context.json({
    from,
    to,
    fetchedAt: new Date().toISOString(),
    tables: {
      workouts: workoutRows,
      workout_exercises: exerciseRows,
      workout_sets: setRows,
    },
  });
});

/**
 * 親 ID で子行を引く。所有者の条件は親を辿らず自テーブルにも掛ける
 * （どのテーブル単独で見ても他人の行が出ないようにする）。
 */
const selectChildren = async (
  database: D1Database,
  table: SyncTable,
  scope: ReturnType<typeof scopeForUser>,
  parentColumn: string,
  parentIds: readonly string[],
  suffix: string,
): Promise<Record<string, unknown>[]> => {
  const rows: Record<string, unknown>[] = [];
  const columns = columnNamesOf(table).join(', ');
  for (let offset = 0; offset < parentIds.length; offset += IDS_PER_QUERY) {
    const chunk = parentIds.slice(offset, offset + IDS_PER_QUERY);
    const placeholders = chunk.map(() => '?').join(', ');
    const result = await database
      .prepare(
        `SELECT ${columns} FROM ${table.name}
         WHERE ${scope.condition} AND ${parentColumn} IN (${placeholders}) ${suffix}`,
      )
      .bind(...scope.params, ...chunk)
      .all();
    rows.push(...(result.results as Record<string, unknown>[]));
  }
  return rows;
};
