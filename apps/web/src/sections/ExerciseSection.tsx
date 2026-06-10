import { useMemo, useState } from 'react';

import { exerciseOptions, exerciseSeries } from '../data/analytics';
import type { Dataset } from '../types/domain';
import { LineChart, type LinePoint } from '../components/LineChart';
import { Section } from '../components/Section';
import { formatShortDate } from '../utils/datetime';
import { formatVolume, formatWeight } from '../utils/number';

// 種目別グラフ: 種目を選び、トップ重量・推定1RM・セッションボリュームの推移を表示する。

type ExerciseSectionProps = {
  dataset: Dataset;
};

type SeriesMode = 'topWeight' | 'oneRepMax' | 'volume';

const SERIES_LABELS: Record<SeriesMode, string> = {
  topWeight: 'トップ重量',
  oneRepMax: '推定1RM',
  volume: 'ボリューム',
};

export const ExerciseSection = ({ dataset }: ExerciseSectionProps) => {
  const options = useMemo(() => exerciseOptions(dataset), [dataset]);
  const [selectedExerciseId, setSelectedExerciseId] = useState(options[0]?.exerciseId ?? '');
  const [seriesMode, setSeriesMode] = useState<SeriesMode>('topWeight');

  const series = useMemo(
    () => exerciseSeries(dataset.sessions, selectedExerciseId),
    [dataset, selectedExerciseId],
  );

  const points: LinePoint[] = series.map((point) => ({
    label: formatShortDate(point.dateKey),
    value:
      seriesMode === 'topWeight'
        ? point.topWeightKg
        : seriesMode === 'oneRepMax'
          ? point.bestOneRepMax
          : point.totalVolume,
  }));
  const formatValue = seriesMode === 'volume' ? formatVolume : formatWeight;

  if (options.length === 0) {
    return (
      <Section title="種目別グラフ" subtitle="種目ごとの推移">
        <p className="chart-empty">記録のある種目がありません</p>
      </Section>
    );
  }

  return (
    <Section
      title="種目別グラフ"
      subtitle="トップ重量と推定1RMはウォームアップを除いて計算"
      actions={
        <div className="toggle-group-row">
          <select
            className="exercise-select"
            value={selectedExerciseId}
            onChange={(event) => setSelectedExerciseId(event.target.value)}
          >
            {options.map((option) => (
              <option key={option.exerciseId} value={option.exerciseId}>
                {option.name}（{option.sessionCount}回）
              </option>
            ))}
          </select>
          <div className="toggle-group">
            {(['topWeight', 'oneRepMax', 'volume'] satisfies SeriesMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={mode === seriesMode ? 'toggle toggle-active' : 'toggle'}
                onClick={() => setSeriesMode(mode)}
              >
                {SERIES_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <LineChart points={points} formatValue={formatValue} />
    </Section>
  );
};
