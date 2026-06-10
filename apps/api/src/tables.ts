// 同期（バックアップ/復元）対象のテーブルとカラム定義。
// モバイル側 apps/mobile/src/db/sync.ts と同じ定義を持つ（モノレポ方針によりアプリ間の重複は許容）。
// app_settings は端末ローカル設定（タイマー設定・同期トークン）のため対象外。

export type SyncTable = {
  name: string;
  columns: readonly string[];
};

export const SYNC_TABLES: readonly SyncTable[] = [
  { name: 'body_parts', columns: ['id', 'name', 'order_index', 'created_at', 'updated_at'] },
  {
    name: 'exercises',
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
    columns: ['id', 'performed_at', 'status', 'memo', 'last_saved_at', 'created_at', 'updated_at'],
  },
  {
    name: 'workout_exercises',
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
  { name: 'templates', columns: ['id', 'name', 'created_at', 'updated_at'] },
  {
    name: 'template_exercises',
    columns: ['id', 'template_id', 'exercise_id', 'order_index', 'created_at', 'updated_at'],
  },
  {
    name: 'body_logs',
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
