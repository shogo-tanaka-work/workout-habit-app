// 基本情報（user_profile）の読み出し。
// 書き込みは POST /sync/operations が受け持つため、ここは取得だけを持つ。

import type { AuthenticatedUser } from '../auth/types';
import { scopeForUser } from '../db/scope';

export type UserProfile = {
  /** strength=筋力向上 / hypertrophy=筋肥大 / endurance=持久力 / general=総合。 */
  trainingGoal: string;
  /** null なら未入力。任意入力の項目。 */
  heightCm: number | null;
  /** ジムの月額料金（円）。null は未設定で、0（無料のジム）とは区別する。 */
  gymMonthlyFeeYen: number | null;
  note: string;
  updatedAt: string;
};

/** 本人の基本情報を返す。1ユーザー1行のため、未設定なら null。 */
export const loadUserProfile = async (
  database: D1Database,
  user: AuthenticatedUser,
): Promise<UserProfile | null> => {
  type ProfileRow = {
    training_goal: string;
    height_cm: number | null;
    gym_monthly_fee_yen: number | null;
    note: string;
    updated_at: string;
  };
  const scope = scopeForUser(user, 'user_id');
  const row = await database
    .prepare(
      `SELECT training_goal, height_cm, gym_monthly_fee_yen, note, updated_at
       FROM user_profile
       WHERE ${scope.condition}`,
    )
    .bind(...scope.params)
    .first<ProfileRow>();
  if (row === null) {
    return null;
  }
  return {
    trainingGoal: row.training_goal,
    heightCm: row.height_cm,
    gymMonthlyFeeYen: row.gym_monthly_fee_yen,
    note: row.note,
    updatedAt: row.updated_at,
  };
};
