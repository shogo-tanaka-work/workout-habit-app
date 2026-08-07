// 同期（バックアップ/復元）対象のテーブルとカラム定義。
// モバイル側 apps/mobile/src/db/sync.ts と同じ定義を持つ（モノレポ方針によりアプリ間の重複は許容）。
// app_settings は端末ローカル設定（タイマー設定・同期トークン）のため対象外。
//
// body_parts は全ユーザー共有のマスタで、端末側も seed で同じ行を持つ。
// 所有者を持てず置換のスコープを切れないため、同期対象から外している。
//
// columns はクライアントとやり取りする列。所有者の列（ownerColumn）は含めない。
// 所有者はサーバが認証結果から決めるものであり、クライアントの申告を信用しない。

export type SyncTable = {
  name: string;
  columns: readonly string[];
  /** 行の所有者を指す列。置換とスコープはこの列で行う。 */
  ownerColumn: 'user_id' | 'owner_user_id';
};

export const SYNC_TABLES: readonly SyncTable[] = [
  {
    // owner_user_id が NULL の行は共有プリセット。置換対象はユーザーのカスタム種目だけ。
    name: 'exercises',
    ownerColumn: 'owner_user_id',
    columns: [
      'id',
      'name',
      'primary_body_part_id',
      'default_rest_seconds',
      'default_bar_weight_kg',
      'category',
      'is_archived',
      'created_at',
      'updated_at',
    ],
  },
  {
    name: 'workouts',
    ownerColumn: 'user_id',
    columns: [
      'id',
      'performed_at',
      'status',
      'source',
      'memo',
      'last_saved_at',
      'created_at',
      'updated_at',
    ],
  },
  {
    name: 'workout_exercises',
    ownerColumn: 'user_id',
    columns: [
      'id',
      'workout_id',
      'exercise_id',
      'order_index',
      'rest_seconds_override',
      'memo',
      'created_at',
      'updated_at',
    ],
  },
  {
    name: 'workout_sets',
    ownerColumn: 'user_id',
    columns: [
      'id',
      'workout_exercise_id',
      'order_index',
      'weight_kg',
      'reps',
      'rpe',
      'is_warmup',
      'is_completed',
      'memo',
      'rest_seconds',
      'started_at',
      'completed_at',
      'deleted_at',
      'created_at',
      'updated_at',
    ],
  },
  {
    name: 'timer_events',
    ownerColumn: 'user_id',
    columns: [
      'id',
      'workout_set_id',
      'exercise_id',
      'duration_seconds',
      'started_at',
      'ended_at',
      'status',
      'sound_enabled',
      'created_at',
      'updated_at',
    ],
  },
  { name: 'templates', ownerColumn: 'user_id', columns: ['id', 'name', 'created_at', 'updated_at'] },
  {
    name: 'template_exercises',
    ownerColumn: 'user_id',
    columns: ['id', 'template_id', 'exercise_id', 'order_index', 'created_at', 'updated_at'],
  },
  {
    name: 'body_logs',
    ownerColumn: 'user_id',
    columns: [
      'id',
      'measured_at',
      'body_weight_kg',
      'body_fat_percentage',
      'estimated_calories_burned',
      'memo',
      'created_at',
      'updated_at',
    ],
  },
];

export type BackupPayload = {
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
};
