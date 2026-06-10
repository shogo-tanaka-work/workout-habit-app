import { useState } from 'react';

import { LineChart, type LinePoint } from '../components/LineChart';
import { Loadable } from '../components/Loadable';
import { Section } from '../components/Section';
import { useApiData } from '../hooks/useApiData';
import type { BodyLogsResponse } from '../types/api';
import { formatShortDate } from '../utils/datetime';

// ボディログ: /analytics/body-logs の体重・体脂肪率推移。変化幅が小さいため非ゼロ基準で描く。

type BodyMetricMode = 'weight' | 'fat';

export const BodyLogSection = () => {
  const [metricMode, setMetricMode] = useState<BodyMetricMode>('weight');
  const state = useApiData<BodyLogsResponse>('/analytics/body-logs');

  const formatValue = (value: number): string =>
    metricMode === 'weight' ? `${value.toFixed(1)}kg` : `${value.toFixed(1)}%`;

  return (
    <Section
      title="ボディログ"
      subtitle="体重・体脂肪率の推移"
      actions={
        <div className="toggle-group">
          {(['weight', 'fat'] satisfies BodyMetricMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={mode === metricMode ? 'toggle toggle-active' : 'toggle'}
              onClick={() => setMetricMode(mode)}
            >
              {mode === 'weight' ? '体重' : '体脂肪率'}
            </button>
          ))}
        </div>
      }
    >
      <Loadable state={state}>
        {(response) => {
          const points: LinePoint[] = response.bodyLogs
            .map((bodyLog) => ({
              label: formatShortDate(bodyLog.date),
              value: metricMode === 'weight' ? bodyLog.bodyWeightKg : bodyLog.bodyFatPercentage,
            }))
            .filter((point): point is LinePoint => point.value !== null);
          return (
            <LineChart
              points={points}
              color="var(--chart-secondary)"
              scaleFromZero={false}
              formatValue={formatValue}
            />
          );
        }}
      </Loadable>
    </Section>
  );
};
