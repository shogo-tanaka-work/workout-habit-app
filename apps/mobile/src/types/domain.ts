// アプリ内（UI/ロジック）で扱うドメイン型。camelCase。
// SQLite から取れる行型（snake_case）は ./db.ts に分離している。

export type Tab = 'home' | 'workout' | 'history' | 'exercises';

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

export type Workout = {
  id: string;
  performedAt: string;
  status: 'active' | 'completed';
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

// 休憩タイマー終了時の通知方法の設定。
export type TimerSettings = {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
};

// クラウドバックアップの接続設定（app_settings に保存。端末ローカル・同期対象外）。
// サーバとの接続設定。認証は Google サインイン（src/auth/googleAuth.ts）が担うため、
// トークンは端末に保存しない。
export type SyncSettings = {
  apiUrl: string;
  lastBackupAt: string | null;
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

// ホームに出す「今週（月曜はじまり）」の集計。
export type WeeklyStats = {
  workoutCount: number;
  setCount: number;
  totalVolume: number;
  totalReps: number;
};
