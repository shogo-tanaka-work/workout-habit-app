// /analytics API のレスポンス型（apps/api/src/analytics.ts の JSON と対応）。
// 集計は API 側に集約済みのため、クライアントは表示用の整形だけを行う。

export type PeriodSummary = {
  workoutCount: number;
  setCount: number;
  totalVolume: number;
  totalReps: number;
};

export type WeeklyResponse = {
  today: string;
  since: string;
  weeks: ({ weekStart: string } & PeriodSummary)[];
};

export type MonthlyResponse = {
  today: string;
  since: string;
  months: ({ month: string } & PeriodSummary)[];
};

export type BodyPartWeekSummary = {
  bodyPartId: string;
  name: string;
  setCount: number;
  totalVolume: number;
  totalReps: number;
};

export type BodyPartsResponse = {
  today: string;
  since: string;
  weeks: { weekStart: string; bodyParts: BodyPartWeekSummary[] }[];
};

export type ExerciseListItem = {
  id: string;
  name: string;
  bodyPartName: string;
  sessionCount: number;
  lastPerformedAt: string | null;
  bestOneRepMax: number;
};

export type ExercisesResponse = {
  exercises: ExerciseListItem[];
};

export type ExerciseSession = {
  date: string;
  setCount: number;
  totalVolume: number;
  totalReps: number;
  maxReps: number;
  topWeightKg: number;
  bestOneRepMax: number;
};

export type ExerciseDetailResponse = {
  exercise: { id: string; name: string };
  today: string;
  since: string;
  summary: {
    sessionCount: number;
    setCount: number;
    totalVolume: number;
    bestOneRepMax: number;
  };
  sessions: ExerciseSession[];
};

export type HabitResponse = {
  today: string;
  since: string;
  currentWeekStart: string;
  thisWeekCount: number;
  lastWorkoutDate: string | null;
  currentStreakWeeks: number;
  activeWeeks: number;
  totalWeeks: number;
  averageWorkoutsPerWeek: number;
  weeks: { weekStart: string; workoutCount: number }[];
};

export type DailyResponse = {
  today: string;
  since: string;
  totalWorkouts: number;
  days: { date: string; workoutCount: number; setCount: number; totalVolume: number }[];
};

export type BodyLogsResponse = {
  bodyLogs: { date: string; bodyWeightKg: number | null; bodyFatPercentage: number | null }[];
};

export type MeResponse = {
  id: string;
  role: 'admin' | 'member';
  status: string;
  email: string;
  /** 表示用の名前。display_name が空なら email が入る（API 側で寄せている）。 */
  displayName: string;
};

/**
 * /plans のレスポンス。行そのままの形で、テーブル単位に分かれている
 * （モバイルが同じ形で取り込むため。apps/api/src/routes/plans.ts）。
 */
export type PlansResponse = {
  from: string;
  to: string;
  fetchedAt: string;
  tables: {
    workouts: { id: string; performed_at: string; memo: string; source: string }[];
    workout_exercises: { id: string; workout_id: string; exercise_id: string; order_index: number }[];
    workout_sets: {
      id: string;
      workout_exercise_id: string;
      order_index: number;
      weight_kg: number;
      reps: number;
    }[];
  };
};
