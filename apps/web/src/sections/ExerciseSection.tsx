import { useState } from 'react';

import { LineChart, type LinePoint } from '../components/LineChart';
import { Loadable } from '../components/Loadable';
import { Section } from '../components/Section';
import { useApiData } from '../hooks/useApiData';
import type { ExerciseDetailResponse, ExercisesResponse } from '../types/api';
import { formatDateKey, formatShortDate } from '../utils/datetime';
import { formatVolume, formatWeight } from '../utils/number';

// 種目別グラフ: /analytics/exercises で種目を選び、
// /analytics/exercises/:id のセッション推移を表示する。

type SeriesMode = 'topWeight' | 'oneRepMax' | 'volume';

const SERIES_LABELS: Record<SeriesMode, string> = {
  topWeight: 'トップ重量',
  oneRepMax: '推定1RM',
  volume: 'ボリューム',
};

const DETAIL_MONTHS = 12;

export const ExerciseSection = () => {
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [seriesMode, setSeriesMode] = useState<SeriesMode>('topWeight');
  const todayKey = formatDateKey(new Date());

  const listState = useApiData<ExercisesResponse>('/analytics/exercises');
  const options = (listState.data?.exercises ?? []).filter(
    (exercise) => exercise.sessionCount > 0,
  );
  // 未選択時は実施回数最多の種目（API がソート済み）を初期表示にする。
  const effectiveExerciseId = selectedExerciseId || options[0]?.id || '';
  const detailState = useApiData<ExerciseDetailResponse>(
    effectiveExerciseId
      ? `/analytics/exercises/${effectiveExerciseId}?months=${DETAIL_MONTHS}&today=${todayKey}`
      : null,
  );

  return (
    <Section
      title="種目別グラフ"
      subtitle={`直近${DETAIL_MONTHS}か月のセッション推移（推定1RMはEpley式）`}
      actions={
        <div className="toggle-group-row">
          <select
            className="exercise-select"
            value={effectiveExerciseId}
            onChange={(event) => setSelectedExerciseId(event.target.value)}
          >
            {options.map((option) => (
              <option key={option.id} value={option.id}>
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
      <Loadable state={listState}>
        {() =>
          options.length === 0 ? (
            <p className="chart-empty">記録のある種目がありません</p>
          ) : (
            <Loadable state={detailState}>
              {(detail) => {
                const points: LinePoint[] = detail.sessions.map((session) => ({
                  label: formatShortDate(session.date),
                  value:
                    seriesMode === 'topWeight'
                      ? session.topWeightKg
                      : seriesMode === 'oneRepMax'
                        ? session.bestOneRepMax
                        : session.totalVolume,
                }));
                const formatValue = seriesMode === 'volume' ? formatVolume : formatWeight;
                return <LineChart points={points} formatValue={formatValue} />;
              }}
            </Loadable>
          )
        }
      </Loadable>
    </Section>
  );
};
