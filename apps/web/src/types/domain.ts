// ダッシュボードで使うドメイン型（camelCase）。
// DB行（snake_case・unknown）からの変換は data/transform.ts に集約する。

export type BodyPart = {
  id: string;
  name: string;
  orderIndex: number;
};

export type Exercise = {
  id: string;
  name: string;
  primaryBodyPartId: string;
};

export type CompletedSet = {
  weightKg: number;
  reps: number;
  isWarmup: boolean;
};

// 1回のワークアウト内での1種目分の記録。
export type SessionEntry = {
  exerciseId: string;
  sets: CompletedSet[];
};

// 完了済みワークアウト1回分。
export type WorkoutSession = {
  id: string;
  dateKey: string; // YYYY-MM-DD
  entries: SessionEntry[];
};

export type BodyLog = {
  dateKey: string;
  bodyWeightKg: number | null;
  bodyFatPercentage: number | null;
};

export type Dataset = {
  exportedAt: string;
  bodyParts: BodyPart[];
  exercises: Exercise[];
  sessions: WorkoutSession[]; // dateKey 昇順
  bodyLogs: BodyLog[]; // dateKey 昇順
};
