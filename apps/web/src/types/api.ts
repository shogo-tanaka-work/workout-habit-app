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
