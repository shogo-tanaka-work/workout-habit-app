// 同期対象エンティティの定義。apps/api/src/tables.ts と対になる
// （モノレポ方針によりアプリ間の重複は許容。片方だけ変えない）。
//
// app_settings と sync_outbox は端末ローカルのため対象外。
// body_parts は全ユーザー共有のマスタで、端末は seed で同じ行を持つため同期しない。
//
// columns は「送信時にスナップショットとして読み出す列」。
// 所有者（user_id / owner_user_id）はサーバが認証結果から決めるので端末は持たない。

import { newId } from '../utils/id';

export type SyncEntity =
  | 'exercises'
  | 'workouts'
  | 'workout_exercises'
  | 'workout_sets'
  | 'user_exercise_settings'
  | 'timer_events'
  | 'templates'
  | 'template_exercises'
  | 'body_logs'
  | 'weekly_feedback'
  | 'exercise_goals'
  | 'training_phases';

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
  // 週次の AI フィードバック。user_id はサーバが埋めるので端末は持たない。
  weekly_feedback: ['id', 'week_start', 'body', 'created_at', 'updated_at'],
  // 種目別の目標重量。親は exercises。
  exercise_goals: ['id', 'exercise_id', 'target_weight_kg', 'memo', 'created_at', 'updated_at'],
  // トレーニングのフェーズ（減量・増量・維持・中断）の履歴。ended_on が NULL なら進行中。
  training_phases: ['id', 'phase', 'started_on', 'ended_on', 'note', 'created_at', 'updated_at'],
};

/**
 * カスタム種目の ID 接頭辞。プリセット種目は 'bench-press' のような固定 slug で、
 * サーバ側では全ユーザー共有の行になっている。プリセットの変更は送っても拒否されるため、
 * 種目の同期はカスタム種目だけを対象にする。
 */
const CUSTOM_EXERCISE_ID_PREFIX = 'exercise';

/**
 * カスタム種目の ID を発番する。**判定（`isCustomExerciseId`）と同じ定数を使う。**
 *
 * かつては呼び出し側が `newId('exercise')` と文字列で書いており、この接頭辞との
 * 対応がどこにも書かれていなかった。片方を変えると全カスタム種目がプリセット扱いになり、
 * 名前・部位の変更が保存されなくなる（型でも lint でも検出できない）。
 */
export const newCustomExerciseId = (): string => newId(CUSTOM_EXERCISE_ID_PREFIX);

export const isCustomExerciseId = (exerciseId: string): boolean =>
  exerciseId.startsWith(`${CUSTOM_EXERCISE_ID_PREFIX}-`);
