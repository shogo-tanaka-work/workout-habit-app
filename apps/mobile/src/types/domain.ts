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

export type WorkoutStats = {
  completedSetCount: number;
  totalVolume: number;
  totalReps: number;
};
