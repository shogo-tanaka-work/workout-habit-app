// トレーニングのフェーズ履歴（training_phases）の読み出し。
// 書き込みは POST /sync/operations が受け持つため、ここは取得だけを持つ。

import type { AuthenticatedUser } from '../auth/types';
import { scopeForUser } from '../db/scope';

export type TrainingPhaseEntry = {
  phase: string;
  startedOn: string;
  /** null なら進行中。 */
  endedOn: string | null;
  note: string;
  updatedAt: string;
};

/** 本人のフェーズ履歴を開始日の新しい順で返す（現在のフェーズが先頭に来る）。 */
export const loadTrainingPhases = async (
  database: D1Database,
  user: AuthenticatedUser,
): Promise<TrainingPhaseEntry[]> => {
  type PhaseRow = {
    phase: string;
    started_on: string;
    ended_on: string | null;
    note: string;
    updated_at: string;
  };
  const scope = scopeForUser(user, 'user_id');
  const result = await database
    .prepare(
      `SELECT phase, started_on, ended_on, note, updated_at
       FROM training_phases
       WHERE ${scope.condition}
       ORDER BY started_on DESC`,
    )
    .bind(...scope.params)
    .all<PhaseRow>();
  return result.results.map((row) => ({
    phase: row.phase,
    startedOn: row.started_on,
    endedOn: row.ended_on,
    note: row.note,
    updatedAt: row.updated_at,
  }));
};
