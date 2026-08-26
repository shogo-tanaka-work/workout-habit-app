import type {
  BodyPart,
  Exercise,
  TimerState,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../types/domain';

// テスト用のドメイン値ビルダー。
//
// **テストが関心のあるフィールドだけを書けるようにする。** 型が広いドメイン値を
// テストごとに丸ごと書くと、フィールドが1つ増えるたび全テストが赤くなり、
// どの値がその検証の主題なのかも読み取れなくなる。
//
// 本番コードからは参照しない（`src/test-support/` はテスト専用）。

export const buildBodyPart = (overrides: Partial<BodyPart> = {}): BodyPart => ({
  id: 'chest',
  name: '胸',
  orderIndex: 1,
  ...overrides,
});

export const buildExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 'bench-press',
  name: 'ベンチプレス',
  primaryBodyPartId: 'chest',
  defaultRestSeconds: 120,
  defaultBarWeightKg: 20,
  category: 'compound',
  isArchived: false,
  ...overrides,
});

export const buildWorkout = (overrides: Partial<Workout> = {}): Workout => ({
  id: 'workout-1',
  performedAt: '2026-08-27',
  status: 'completed',
  memo: '',
  lastSavedAt: '2026-08-27T10:00:00.000Z',
  createdAt: '2026-08-27T09:00:00.000Z',
  ...overrides,
});

export const buildWorkoutExercise = (
  overrides: Partial<WorkoutExercise> = {},
): WorkoutExercise => ({
  id: 'workout-exercise-1',
  workoutId: 'workout-1',
  exerciseId: 'bench-press',
  orderIndex: 1,
  restSecondsOverride: null,
  memo: '',
  ...overrides,
});

export const buildWorkoutSet = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: 'set-1',
  workoutExerciseId: 'workout-exercise-1',
  orderIndex: 1,
  weightKg: 60,
  reps: 10,
  rpe: 0,
  isWarmup: false,
  isCompleted: false,
  memo: '',
  restSeconds: 120,
  deletedAt: null,
  ...overrides,
});

export const buildTimerState = (overrides: Partial<TimerState> = {}): TimerState => ({
  workoutSetId: 'set-1',
  exerciseName: 'ベンチプレス',
  duration: 120,
  remaining: 120,
  running: true,
  finished: false,
  endsAt: null,
  ...overrides,
});
