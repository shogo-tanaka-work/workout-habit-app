import { useState } from 'react';

import type { Dataset } from '../types/domain';
import { LineChart, type LinePoint } from '../components/LineChart';
import { Section } from '../components/Section';
import { formatShortDate } from '../utils/datetime';

// ボディログ: 体重・体脂肪率の推移。変化幅が小さいため非ゼロ基準で描く。

type BodyLogSectionProps = {
  dataset: Dataset;
};

type BodyMetricMode = 'weight' | 'fat';

export const BodyLogSection = ({ dataset }: BodyLogSectionProps) => {
  const [metricMode, setMetricMode] = useState<BodyMetricMode>('weight');

  const points: LinePoint[] = dataset.bodyLogs
    .map((bodyLog) => ({
      label: formatShortDate(bodyLog.dateKey),
      value: metricMode === 'weight' ? bodyLog.bodyWeightKg : bodyLog.bodyFatPercentage,
    }))
    .filter((point): point is LinePoint => point.value !== null);

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
      <LineChart
        points={points}
        color="var(--chart-secondary)"
        scaleFromZero={false}
        formatValue={formatValue}
      />
    </Section>
  );
};
