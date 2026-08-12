// 同期対象エンティティの定義。apps/api/src/tables.ts と対になる
// （モノレポ方針によりアプリ間の重複は許容。片方だけ変えない）。
//
// app_settings と sync_outbox は端末ローカルのため対象外。
// body_parts は全ユーザー共有のマスタで、端末は seed で同じ行を持つため同期しない。
//
// columns は「送信時にスナップショットとして読み出す列」。
// 所有者（user_id / owner_user_id）はサーバが認証結果から決めるので端末は持たない。

export type SyncEntity =
  | 'exercises'
  | 'workouts'
  | 'workout_exercises'
  | 'workout_sets'
  | 'user_exercise_settings'
  | 'timer_events'
  | 'templates'
  | 'template_exercises'
  | 'body_logs';

export const SYNC_COLUMNS: Record<SyncEntity, readonly string[]> = {
  exercises: [
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
  workouts: ['id', 'performed_at', 'status', 'memo', 'last_saved_at', 'created_at', 'updated_at'],
  workout_exercises: [
    'id',
    'workout_id',
    'exercise_id',
    'order_index',
    'rest_seconds_override',
    'memo',
    'created_at',
    'updated_at',
  ],
  workout_sets: [
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
  // 共有プリセット種目のユーザー別上書き。user_id はサーバが埋めるので端末は持たない。
  user_exercise_settings: [
    'id',
    'exercise_id',
    'rest_seconds',
    'bar_weight_kg',
    'is_archived',
    'created_at',
    'updated_at',
  ],
  timer_events: [
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
  templates: ['id', 'name', 'created_at', 'updated_at'],
  template_exercises: [
    'id',
    'template_id',
    'exercise_id',
    'order_index',
    'created_at',
    'updated_at',
  ],
  body_logs: [
    'id',
    'measured_at',
    'body_weight_kg',
    'body_fat_percentage',
    'estimated_calories_burned',
    'memo',
    'created_at',
    'updated_at',
  ],
};

/**
 * カスタム種目の ID 接頭辞。プリセット種目は 'bench-press' のような固定 slug で、
 * サーバ側では全ユーザー共有の行になっている。プリセットの変更は送っても拒否されるため、
 * 種目の同期はカスタム種目だけを対象にする。
 */
export const CUSTOM_EXERCISE_ID_PREFIX = 'exercise-';

export const isCustomExerciseId = (exerciseId: string): boolean =>
  exerciseId.startsWith(CUSTOM_EXERCISE_ID_PREFIX);
