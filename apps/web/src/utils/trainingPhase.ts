import type { TrainingPhase, TrainingPhaseKind } from '../types/api';
import { countDaysBetween } from './datetime';

// トレーニングのフェーズ（training_phases）の表示整形。集計は持たない。
// ラベル対応・未知値のフォールバック・現在／過去の判定を、画面ごとに決めさせないため1か所へ置く。

const LABEL_BY_PHASE: Record<TrainingPhaseKind, string> = {
  cut: '減量期',
  bulk: '増量期',
  maintain: '維持期',
  break: '中断',
};

// API 側が値を増やしても画面が空欄にならないようにする既定ラベル。
const UNKNOWN_PHASE_LABEL = 'フェーズ';

const LABEL_TABLE = new Map<string, string>(Object.entries(LABEL_BY_PHASE));

/** フェーズ種別の日本語ラベル。契約外の値は既定ラベルへ寄せる。 */
export const phaseLabelOf = (phase: string): string =>
  LABEL_TABLE.get(phase) ?? UNKNOWN_PHASE_LABEL;

/** フェーズ開始日を1日目としたときの、その日が何日目か。 */
export const countPhaseDays = (startedOn: string, todayKey: string): number =>
  countDaysBetween(startedOn, todayKey) + 1;

/** "2026-04-01〜2026-05-20"（進行中は終端を空ける）。 */
export const formatPhasePeriod = (phase: TrainingPhase): string =>
  `${phase.startedOn}〜${phase.endedOn ?? ''}`;

type SplitPhases = {
  /** 進行中（endedOn が null）のうち startedOn が最大のもの。無ければ null。 */
  current: TrainingPhase | null;
  /** 現在のフェーズ以外を、新しい順に並べたもの。 */
  past: TrainingPhase[];
};

/** フェーズ一覧を「現在」と「過去」に分ける。API の並び順に依存しないよう自前で降順にする。 */
export const splitTrainingPhases = (phases: readonly TrainingPhase[]): SplitPhases => {
  const newestFirst = [...phases].sort((a, b) => b.startedOn.localeCompare(a.startedOn));
  const current = newestFirst.find((phase) => phase.endedOn === null) ?? null;
  return {
    current,
    past: newestFirst.filter((phase) => phase !== current),
  };
};
