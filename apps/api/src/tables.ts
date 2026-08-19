// 同期対象のエンティティ定義。バックアップ（src/backup.ts）と
// 操作ベースの同期（src/sync/）の両方がこの定義を正とする。
// モバイル側 apps/mobile/src/db/sync.ts と対になる（モノレポ方針によりアプリ間の重複は許容）。
// app_settings は端末ローカル設定（タイマー設定）のため対象外。
//
// body_parts は全ユーザー共有のマスタで、端末側も seed で同じ行を持つ。
// 所有者を持てず置換のスコープを切れないため、同期対象から外している。
//
// columns はクライアントとやり取りする列。所有者の列（ownerColumn）は含めない。
// 所有者はサーバが認証結果から決めるものであり、クライアントの申告を信用しない。

type ColumnType = 'text' | 'integer' | 'real';

export type SyncColumn = {
  name: string;
  type: ColumnType;
  /** NULL を許す列。 */
  nullable?: boolean;
  /** 省略を許す列（DB 側に DEFAULT があるか NULL 可）。 */
  optional?: boolean;
};

/** 親テーブルへの参照。存在と所有者の一致を検証する。 */
type ParentReference = {
  column: string;
  table: string;
};

export type SyncTable = {
  name: string;
  /** 行の所有者を指す列。置換とスコープはこの列で行う。 */
  ownerColumn: 'user_id' | 'owner_user_id';
  columns: readonly SyncColumn[];
  parents?: readonly ParentReference[];
  /**
   * id 以外に行を一意に決める列。所有者の列との複合ユニーク制約と対にする
   * （例: body_logs の `UNIQUE (user_id, measured_at)`）。
   *
   * 端末は id をローカルで採番するため、同じ実体を別の経路・別端末が別 id で作りうる。
   * 適用側（src/sync/apply.ts）はこの列で既存行を引き当て、更新へ寄せる。
   * 所有者の列だけで一意なテーブル（user_profile）は空配列にする。
   *
   * **ユニーク制約を足したら、ここにも同じ組み合わせを足す。**
   */
  naturalKey?: readonly string[];
};

const timestamps: readonly SyncColumn[] = [
  { name: 'created_at', type: 'text' },
  { name: 'updated_at', type: 'text' },
];

export const SYNC_TABLES: readonly SyncTable[] = [
  {
    // owner_user_id が NULL の行は共有プリセット。置換対象はユーザーのカスタム種目だけ。
    name: 'exercises',
    ownerColumn: 'owner_user_id',
    columns: [
      { name: 'id', type: 'text' },
      { name: 'name', type: 'text' },
      { name: 'primary_body_part_id', type: 'text' },
      { name: 'default_rest_seconds', type: 'integer' },
      { name: 'default_bar_weight_kg', type: 'real' },
      { name: 'category', type: 'text' },
      { name: 'is_archived', type: 'integer', optional: true },
      ...timestamps,
    ],
    parents: [{ column: 'primary_body_part_id', table: 'body_parts' }],
  },
  {
    name: 'workouts',
    ownerColumn: 'user_id',
    columns: [
      { name: 'id', type: 'text' },
      { name: 'performed_at', type: 'text' },
      { name: 'status', type: 'text' },
      { name: 'source', type: 'text', optional: true },
      { name: 'memo', type: 'text', optional: true },
      { name: 'last_saved_at', type: 'text' },
      ...timestamps,
    ],
  },
  {
    name: 'workout_exercises',
    ownerColumn: 'user_id',
    columns: [
      { name: 'id', type: 'text' },
      { name: 'workout_id', type: 'text' },
      { name: 'exercise_id', type: 'text' },
      { name: 'order_index', type: 'integer' },
      { name: 'rest_seconds_override', type: 'integer', nullable: true, optional: true },
      { name: 'memo', type: 'text', optional: true },
      ...timestamps,
    ],
    parents: [
      { column: 'workout_id', table: 'workouts' },
      { column: 'exercise_id', table: 'exercises' },
    ],
  },
  {
    name: 'workout_sets',
    ownerColumn: 'user_id',
    columns: [
      { name: 'id', type: 'text' },
      { name: 'workout_exercise_id', type: 'text' },
      { name: 'order_index', type: 'integer' },
      { name: 'weight_kg', type: 'real' },
      { name: 'reps', type: 'integer' },
      { name: 'rpe', type: 'real' },
      { name: 'is_warmup', type: 'integer', optional: true },
      { name: 'is_completed', type: 'integer', optional: true },
      { name: 'memo', type: 'text', optional: true },
      { name: 'rest_seconds', type: 'integer' },
      { name: 'started_at', type: 'text', nullable: true, optional: true },
      { name: 'completed_at', type: 'text', nullable: true, optional: true },
      { name: 'deleted_at', type: 'text', nullable: true, optional: true },
      ...timestamps,
    ],
    parents: [{ column: 'workout_exercise_id', table: 'workout_exercises' }],
  },
  {
    name: 'timer_events',
    ownerColumn: 'user_id',
    columns: [
      { name: 'id', type: 'text' },
      { name: 'workout_set_id', type: 'text' },
      { name: 'exercise_id', type: 'text' },
      { name: 'duration_seconds', type: 'integer' },
      { name: 'started_at', type: 'text' },
      { name: 'ended_at', type: 'text', nullable: true, optional: true },
      { name: 'status', type: 'text' },
      { name: 'sound_enabled', type: 'integer' },
      ...timestamps,
    ],
    parents: [
      { column: 'workout_set_id', table: 'workout_sets' },
      { column: 'exercise_id', table: 'exercises' },
    ],
  },
  {
    name: 'templates',
    ownerColumn: 'user_id',
    columns: [{ name: 'id', type: 'text' }, { name: 'name', type: 'text' }, ...timestamps],
  },
  {
    name: 'template_exercises',
    ownerColumn: 'user_id',
    columns: [
      { name: 'id', type: 'text' },
      { name: 'template_id', type: 'text' },
      { name: 'exercise_id', type: 'text' },
      { name: 'order_index', type: 'integer' },
      ...timestamps,
    ],
    parents: [
      { column: 'template_id', table: 'templates' },
      { column: 'exercise_id', table: 'exercises' },
    ],
  },
  {
    // 共有プリセット種目に対する、ユーザーごとの上書き（migration 0004）。
    // NULL の列は「上書きしない」。親は共有プリセットなので owner が NULL でも参照できる
    // （parentIsUsable が owner === null を許可している）。
    name: 'user_exercise_settings',
    ownerColumn: 'user_id',
    naturalKey: ['exercise_id'],
    columns: [
      { name: 'id', type: 'text' },
      { name: 'exercise_id', type: 'text' },
      { name: 'rest_seconds', type: 'integer', nullable: true, optional: true },
      { name: 'bar_weight_kg', type: 'real', nullable: true, optional: true },
      { name: 'is_archived', type: 'integer', nullable: true, optional: true },
      ...timestamps,
    ],
    parents: [{ column: 'exercise_id', table: 'exercises' }],
  },
  {
    // 週次 AI フィードバックのアーカイブ（migration 0005）。Claude Code が計画立案時に書く。
    // week_start は月曜はじまりの週開始日（YYYY-MM-DD）。同一週の上書きは同じ id を再利用する。
    name: 'weekly_feedback',
    ownerColumn: 'user_id',
    naturalKey: ['week_start'],
    columns: [
      { name: 'id', type: 'text' },
      { name: 'week_start', type: 'text' },
      { name: 'body', type: 'text' },
      ...timestamps,
    ],
  },
  {
    // 種目ごとの目標重量（migration 0005）。親は共有プリセットでも参照できる
    // （user_exercise_settings と同じ扱い。parentIsUsable が owner === null を許可している）。
    name: 'exercise_goals',
    ownerColumn: 'user_id',
    naturalKey: ['exercise_id'],
    columns: [
      { name: 'id', type: 'text' },
      { name: 'exercise_id', type: 'text' },
      { name: 'target_weight_kg', type: 'real' },
      { name: 'memo', type: 'text', optional: true },
      ...timestamps,
    ],
    parents: [{ column: 'exercise_id', table: 'exercises' }],
  },
  {
    // トレーニングのフェーズ履歴（migration 0006）。Claude Code が計画立案の前提として書く。
    // ended_on が NULL の行が進行中。同じ開始日の書き直しは同じ id を再利用する。
    name: 'training_phases',
    ownerColumn: 'user_id',
    naturalKey: ['started_on'],
    columns: [
      { name: 'id', type: 'text' },
      { name: 'phase', type: 'text' },
      { name: 'started_on', type: 'text' },
      { name: 'ended_on', type: 'text', nullable: true, optional: true },
      { name: 'note', type: 'text', optional: true },
      ...timestamps,
    ],
  },
  {
    // 基本情報（migration 0007）。1ユーザー1行で、決定的 id は profile-{userId}。
    // height_cm は任意入力のため NULL 可。書き直しは同じ id を再利用する。
    name: 'user_profile',
    ownerColumn: 'user_id',
    // UNIQUE (user_id) なので、所有者の列だけで1行に決まる。
    naturalKey: [],
    columns: [
      { name: 'id', type: 'text' },
      { name: 'training_goal', type: 'text' },
      { name: 'height_cm', type: 'real', nullable: true, optional: true },
      { name: 'note', type: 'text', optional: true },
      // ジムの月額料金（migration 0009）。NULL は未設定で、0 円（無料のジム）とは別扱い。
      { name: 'gym_monthly_fee_yen', type: 'integer', nullable: true, optional: true },
      ...timestamps,
    ],
  },
  {
    name: 'body_logs',
    ownerColumn: 'user_id',
    naturalKey: ['measured_at'],
    columns: [
      { name: 'id', type: 'text' },
      { name: 'measured_at', type: 'text' },
      { name: 'body_weight_kg', type: 'real' },
      { name: 'body_fat_percentage', type: 'real', nullable: true, optional: true },
      { name: 'estimated_calories_burned', type: 'real', nullable: true, optional: true },
      { name: 'memo', type: 'text', optional: true },
      ...timestamps,
    ],
  },
];

/** 同期対象テーブルを名前で引く。エンティティ名の許可リストも兼ねる。 */
export const findSyncTable = (name: string): SyncTable | undefined =>
  SYNC_TABLES.find((table) => table.name === name);

export const columnNamesOf = (table: SyncTable): string[] =>
  table.columns.map((column) => column.name);

export type BackupPayload = {
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
};
