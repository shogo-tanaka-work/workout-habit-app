import { useApiData } from '../hooks/useApiData';
import type { TrainingPhasesResponse } from '../types/api';
import { formatDateKey } from '../utils/datetime';
import {
  countPhaseDays,
  formatPhasePeriod,
  phaseLabelOf,
  splitTrainingPhases,
} from '../utils/trainingPhase';

// 今どの局面にいるか（減量期・増量期・維持期・中断）の表示。
//
// 実績データの読み方はフェーズで変わる（中断期間の記録の少なさは停滞ではない）ため、
// 継続状況の数値より先に目に入る位置へ置く。過去分は折りたたみで控えめに残す。
//
// 分析の主役ではない補助表示なので、Viewer と同じ扱いにする。
// 取得に失敗しても表示を消すだけで、ダッシュボード本体をエラー画面に変えない。
// 進行中のフェーズが無いときも何も出さない（空状態のプレースホルダで場所を取らない）。

export const PhaseSummary = () => {
  const { data } = useApiData<TrainingPhasesResponse>('/training-phases');
  if (!data) {
    return null;
  }
  const { current, past } = splitTrainingPhases(data.phases);
  if (!current) {
    return null;
  }
  const dayCount = countPhaseDays(current.startedOn, formatDateKey(new Date()));

  return (
    <div className="phase">
      <p className="phase-current">
        <span className="phase-name">{phaseLabelOf(current.phase)}</span>
        <span className="phase-period">{formatPhasePeriod(current)}</span>
        <span className="phase-days">{dayCount}日目</span>
        {current.note ? <span className="phase-note">{current.note}</span> : null}
      </p>
      {past.length > 0 ? (
        <details className="phase-history">
          <summary className="phase-history-summary">過去のフェーズ（{past.length}件）</summary>
          <ul className="phase-history-list">
            {past.map((phase) => (
              <li key={phase.startedOn} className="phase-history-item">
                {formatPhasePeriod(phase)} {phaseLabelOf(phase.phase)}
                {phase.note ? `（${phase.note}）` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
};
