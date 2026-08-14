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

/** 部位内の種目ごとの内訳（積み上げバー用）。 */
export type BodyPartExerciseTotal = {
  exerciseId: string;
  name: string;
  setCount: number;
  totalVolume: number;
};

export type BodyPartTotal = {
  bodyPartId: string;
  name: string;
  setCount: number;
  totalVolume: number;
  totalReps: number;
  /** 種目ごとの内訳。デプロイ順の自由度のため、旧 API（フィールドなし）でも壊れないよう省略可で受ける。 */
  exercises?: BodyPartExerciseTotal[];
};

/** 部位ごとの期間合計。`bodyParts` はボリューム降順で返る。 */
export type BodyPartsResponse = {
  today: string;
  since: string;
  bodyParts: BodyPartTotal[];
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
  days: {
    date: string;
    workoutCount: number;
    setCount: number;
    totalVolume: number;
    /** その日の最大ボリューム部位。旧 API（フィールドなし）でも壊れないよう省略可で受ける。 */
    topBodyPartId?: string | null;
  }[];
};

/** 種目ごとの目標重量（exercise_goals）。目標が無い種目は配列に含まれない。 */
export type ExerciseGoal = {
  exerciseId: string;
  targetWeightKg: number;
  memo: string | null;
  updatedAt: string;
};

export type GoalsResponse = {
  goals: ExerciseGoal[];
};

/** 週単位の AI フィードバック（weekly_feedback）。新しい順で返る。 */
export type WeeklyFeedback = {
  weekStart: string;
  body: string;
  updatedAt: string;
};

export type FeedbackResponse = {
  feedback: WeeklyFeedback[];
};

/** フェーズの種別（training_phases.phase の契約値）。ラベル対応は utils/trainingPhase.ts に置く。 */
export type TrainingPhaseKind = 'cut' | 'bulk' | 'lean_bulk' | 'maintain' | 'break';

/**
 * トレーニングのフェーズ1件（training_phases）。`endedOn` が null なら進行中。
 *
 * `phase` を `TrainingPhaseKind` へ狭めないのは、これが検証していない外部入力だから。
 * API 側が値を増やしても画面が黙って壊れないよう string で受け、
 * `utils/trainingPhase.ts` の1か所でラベルへ解決する（未知値はフォールバック）。
 */
export type TrainingPhase = {
  phase: string;
  startedOn: string;
  endedOn: string | null;
  note: string;
  updatedAt: string;
};

/** /training-phases のレスポンス。startedOn の新しい順で返る。 */
export type TrainingPhasesResponse = {
  phases: TrainingPhase[];
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
