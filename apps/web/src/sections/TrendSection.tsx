import { useState } from 'react';

import { monthlyStats, weeklyStats, type PeriodStat } from '../data/analytics';
import type { Dataset } from '../types/domain';
import { BarChart, type BarPoint } from '../components/BarChart';
import { Section } from '../components/Section';
import {
  formatDateKey,
  formatShortDate,
  listRecentMonthKeys,
  listRecentWeekKeys,
  monthKeyOf,
  weekKeyOf,
} from '../utils/datetime';
import { formatVolume } from '../utils/number';

// 週次 / 月次のトレーニング量推移（ボリューム・セット数・回数を切り替え表示）。

type TrendSectionProps = {
  dataset: Dataset;
};

type PeriodMode = 'weekly' | 'monthly';
type MetricMode = 'volume' | 'sets' | 'workouts';

const WEEK_COUNT = 12;
const MONTH_COUNT = 6;

const METRIC_LABELS: Record<MetricMode, string> = {
  volume: '総ボリューム',
  sets: 'セット数',
  workouts: '回数',
};

const metricValueOf = (stat: PeriodStat, metric: MetricMode): number => {
  switch (metric) {
    case 'volume':
      return stat.totalVolume;
    case 'sets':
      return stat.totalSetCount;
    case 'workouts':
      return stat.workoutCount;
  }
};

const metricFormatter = (metric: MetricMode): ((value: number) => string) =>
  metric === 'volume' ? formatVolume : (value) => String(Math.round(value));

export const TrendSection = ({ dataset }: TrendSectionProps) => {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('weekly');
  const [metricMode, setMetricMode] = useState<MetricMode>('volume');

  const todayKey = formatDateKey(new Date());
  const stats =
    periodMode === 'weekly'
      ? weeklyStats(dataset.sessions, listRecentWeekKeys(WEEK_COUNT))
      : monthlyStats(dataset.sessions, listRecentMonthKeys(MONTH_COUNT));
  const currentPeriodKey = periodMode === 'weekly' ? weekKeyOf(todayKey) : monthKeyOf(todayKey);

  const points: BarPoint[] = stats.map((stat) => ({
    label:
      periodMode === 'weekly' ? formatShortDate(stat.periodKey) : `${Number(stat.periodKey.slice(5))}月`,
    value: metricValueOf(stat, metricMode),
    isCurrent: stat.periodKey === currentPeriodKey,
  }));

  return (
    <Section
      title="週次・月次分析"
      subtitle={
        periodMode === 'weekly' ? `直近${WEEK_COUNT}週の推移` : `直近${MONTH_COUNT}か月の推移`
      }
      actions={
        <div className="toggle-group-row">
          <div className="toggle-group">
            {(['weekly', 'monthly'] satisfies PeriodMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={mode === periodMode ? 'toggle toggle-active' : 'toggle'}
                onClick={() => setPeriodMode(mode)}
              >
                {mode === 'weekly' ? '週次' : '月次'}
              </button>
            ))}
          </div>
          <div className="toggle-group">
            {(['volume', 'sets', 'workouts'] satisfies MetricMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={mode === metricMode ? 'toggle toggle-active' : 'toggle'}
                onClick={() => setMetricMode(mode)}
              >
                {METRIC_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <BarChart points={points} formatValue={metricFormatter(metricMode)} />
    </Section>
  );
};
