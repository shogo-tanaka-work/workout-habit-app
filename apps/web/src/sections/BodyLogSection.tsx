import { useState } from 'react';

import { LineChart, type LinePoint } from '../components/LineChart';
import { Loadable } from '../components/Loadable';
import { Section } from '../components/Section';
import { useApiData } from '../hooks/useApiData';
import type { BodyLogsResponse } from '../types/api';
import { formatDateKey, formatShortDate } from '../utils/datetime';
import { formatBodyFat, formatBodyWeight } from '../utils/number';
import type { ToggleOption } from '../components/ToggleGroup';
import { ToggleGroup } from '../components/ToggleGroup';

// ボディログ: /analytics/body-logs の体重・体脂肪率推移。
// 縦軸は LineChart 共通のデータ範囲基準（非ゼロ基準）で描く。

type BodyMetricMode = 'weight' | 'fat';

const METRIC_OPTIONS: readonly ToggleOption<BodyMetricMode>[] = [
  { value: 'weight', label: '体重' },
  { value: 'fat', label: '体脂肪率' },
];

/** 何か月分を取得するか。種目別グラフの期間（DETAIL_MONTHS）と揃える。 */
const BODY_LOG_MONTHS = 12;

export const BodyLogSection = () => {
  const [metricMode, setMetricMode] = useState<BodyMetricMode>('weight');
  const todayKey = formatDateKey(new Date());
  const state = useApiData<BodyLogsResponse>(
    `/analytics/body-logs?months=${BODY_LOG_MONTHS}&today=${todayKey}`,
  );

  const formatValue = (value: number): string =>
    metricMode === 'weight' ? formatBodyWeight(value) : formatBodyFat(value);

  return (
    <Section
      title="ボディログ"
      subtitle="体重・体脂肪率の推移"
      actions={
        <ToggleGroup options={METRIC_OPTIONS} selected={metricMode} onSelect={setMetricMode} />
      }
    >
      <Loadable state={state}>
        {(response) => {
          const points: LinePoint[] = response.bodyLogs.flatMap((bodyLog) => {
            const value = metricMode === 'weight' ? bodyLog.bodyWeightKg : bodyLog.bodyFatPercentage;
            if (value === null) {
              return [];
            }
            return [{ label: formatShortDate(bodyLog.date), value, dateKey: bodyLog.date }];
          });
          return (
            <LineChart points={points} colorVariable="--chart-secondary" formatValue={formatValue} />
          );
        }}
      </Loadable>
    </Section>
  );
};
