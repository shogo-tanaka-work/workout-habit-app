// アプリ内（UI/ロジック）で扱うドメイン型。camelCase。
// SQLite から取れる行型（snake_case）は ./db.ts に分離している。

export type Tab = 'home' | 'workout' | 'history' | 'settings';

export type BodyPart = {
  id: string;
  name: string;
  orderIndex: number;
};

export type Exercise = {
  id: string;
  name: string;
  primaryBodyPartId: string;
  defaultRestSeconds: number;
  defaultBarWeightKg: number;
  category: string;
  isArchived: boolean;
};

/** 共有プリセット種目に対する、この端末のユーザーの上書き。NULL は「上書きしない」。 */
export type UserExerciseSetting = {
  id: string;
  exerciseId: string;
  restSeconds: number | null;
  barWeightKg: number | null;
  isArchived: boolean | null;
};

export type Workout = {
  id: string;
  performedAt: string;
  status: 'planned' | 'active' | 'completed';
  memo: string;
  lastSavedAt: string;
  createdAt: string;
};

export type WorkoutExercise = {
  id: string;
  workoutId: string;
  exerciseId: string;
  orderIndex: number;
  restSecondsOverride: number | null;
  memo: string;
};

export type WorkoutSet = {
  id: string;
  workoutExerciseId: string;
  orderIndex: number;
  weightKg: number;
  reps: number;
  rpe: number;
  isWarmup: boolean;
  isCompleted: boolean;
  memo: string;
  restSeconds: number;
  deletedAt: string | null;
};

// ワークアウトテンプレート（種目の並びだけを持つ）。
export type Template = {
  id: string;
  name: string;
  createdAt: string;
};

export type TemplateExercise = {
  id: string;
  templateId: string;
  exerciseId: string;
  orderIndex: number;
};

// 休憩タイマー終了時の通知方法と、共通で使い回す休憩時間の設定。
export type TimerSettings = {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  /** 種目をまたいで使い回す休憩時間（秒）。最大 REST_PRESET_LIMIT 件。 */
  restPresets: number[];
};

/** 共通タイマーとして持てるプリセットの上限。 */
export const REST_PRESET_LIMIT = 3;

/** プリセット未設定（初回起動）のときの共通タイマー。 */
export const DEFAULT_REST_PRESETS = [120, 180, 240];

// クラウドバックアップの接続設定（app_settings に保存。端末ローカル・同期対象外）。
// サーバとの接続設定。認証は Google サインイン（src/auth/googleAuth.ts）が担うため、
// トークンは端末に保存しない。
export type SyncSettings = {
  apiUrl: string;
  lastBackupAt: string | null;
  /** 自動送信を止めているか。手動の「今すぐ同期」は止めない。 */
  isPaused: boolean;
};

// 体重・体脂肪のボディログ（1日1件）。
export type BodyLog = {
  id: string;
  measuredAt: string;
  bodyWeightKg: number;
  bodyFatPercentage: number | null;
  memo: string;
};

export type TimerState = {
  workoutSetId: string;
  exerciseName: string;
  duration: number;
  remaining: number;
  running: boolean;
  finished: boolean;
  endsAt: number | null;
};

export type SetPatch = Partial<
  Pick<
    WorkoutSet,
    'weightKg' | 'reps' | 'rpe' | 'isWarmup' | 'isCompleted' | 'memo' | 'restSeconds' | 'deletedAt'
  >
>;
