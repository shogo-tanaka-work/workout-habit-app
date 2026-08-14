import type { TrainingGoal, TrainingPhase, TrainingPhaseKind } from '../types/domain';

// 基本情報（目的）とフェーズの表示整形・選択肢・現在のフェーズの判定。
//
// ラベル対応と「現在のフェーズ」の判定を画面ごとに書かせないため1か所へ置く。
// ラベルは web（apps/web/src/utils/trainingPhase.ts）と同じ語彙にする
// （2アプリで色・語彙・数値の表現を揃える。.agents/DESIGN.md）。

const GOAL_LABELS: Record<TrainingGoal, string> = {
  strength: '筋力向上',
  hypertrophy: '筋肥大',
  endurance: '持久力',
  general: '総合',
};

const PHASE_LABELS: Record<TrainingPhaseKind, string> = {
  cut: '減量期',
  bulk: '増量期',
  maintain: '維持期',
  break: '中断',
};

/** 目的の選択肢（表示順）。画面はこの並びをそのまま出す。 */
export const TRAINING_GOAL_OPTIONS: readonly { value: TrainingGoal; label: string }[] = (
  ['strength', 'hypertrophy', 'endurance', 'general'] as const
).map((value) => ({ value, label: GOAL_LABELS[value] }));

/** フェーズの選択肢（表示順）。 */
export const TRAINING_PHASE_OPTIONS: readonly { value: TrainingPhaseKind; label: string }[] = (
  ['cut', 'bulk', 'maintain', 'break'] as const
).map((value) => ({ value, label: PHASE_LABELS[value] }));

/** 未設定・契約外の値のときに出すラベル。空欄にすると何も選ばれていないのか読み取れない。 */
const UNKNOWN_GOAL_LABEL = '未設定';
const UNKNOWN_PHASE_LABEL = 'フェーズ';

const GOAL_LABEL_TABLE = new Map<string, string>(Object.entries(GOAL_LABELS));
const PHASE_LABEL_TABLE = new Map<string, string>(Object.entries(PHASE_LABELS));

/** 目的の日本語ラベル。契約外の値は既定ラベルへ寄せる（サーバが値を増やしても画面が空にならない）。 */
export const goalLabelOf = (trainingGoal: string): string =>
  GOAL_LABEL_TABLE.get(trainingGoal) ?? UNKNOWN_GOAL_LABEL;

/** フェーズの日本語ラベル。契約外の値は既定ラベルへ寄せる。 */
export const phaseLabelOf = (phase: string): string =>
  PHASE_LABEL_TABLE.get(phase) ?? UNKNOWN_PHASE_LABEL;

/** 保存済みの値が選択肢に無いとき（契約外・未設定）の既定。 */
export const DEFAULT_TRAINING_GOAL: TrainingGoal = 'general';
export const DEFAULT_TRAINING_PHASE: TrainingPhaseKind = 'cut';

/**
 * 現在のフェーズ。進行中（`endedOn === null`）のうち `startedOn` が最大の行。
 * 並び順に依存しないよう、渡された配列の中から自前で選ぶ。
 */
export const findCurrentPhase = (phases: readonly TrainingPhase[]): TrainingPhase | null =>
  phases.reduce<TrainingPhase | null>((current, phase) => {
    if (phase.endedOn !== null) {
      return current;
    }
    return current === null || phase.startedOn > current.startedOn ? phase : current;
  }, null);
