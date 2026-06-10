import { useState } from 'react';

import { BarChart, type BarPoint } from '../components/BarChart';
import { Loadable } from '../components/Loadable';
import { Section } from '../components/Section';
import { useApiData } from '../hooks/useApiData';
import type { MonthlyResponse, PeriodSummary, WeeklyResponse } from '../types/api';
import {
  formatDateKey,
  formatShortDate,
  listRecentMonthKeys,
  listRecentWeekKeys,
} from '../utils/datetime';
import { formatVolume } from '../utils/number';

// 週次 / 月次のトレーニング量推移。集計は /analytics/weekly・/analytics/monthly に委ね、
// クライアントは記録ゼロの週・月の穴埋めと表示だけを行う。

type PeriodMode = 'weekly' | 'monthly';
type MetricMode = 'volume' | 'sets' | 'workouts';

const WEEK_COUNT = 12;
const MONTH_COUNT = 6;

const METRIC_LABELS: Record<MetricMode, string> = {
  volume: '総ボリューム',
  sets: 'セット数',
  workouts: '回数',
};

const metricValueOf = (summary: PeriodSummary | undefined, metric: MetricMode): number => {
  if (!summary) {
    return 0;
  }
  switch (metric) {
    case 'volume':
      return summary.totalVolume;
    case 'sets':
      return summary.setCount;
    case 'workouts':
      return summary.workoutCount;
  }
};

const metricFormatter = (metric: MetricMode): ((value: number) => string) =>
  metric === 'volume' ? formatVolume : (value) => String(Math.round(value));

export const TrendSection = () => {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('weekly');
  const [metricMode, setMetricMode] = useState<MetricMode>('volume');
  const todayKey = formatDateKey(new Date());

  const weeklyState = useApiData<WeeklyResponse>(
    periodMode === 'weekly' ? `/analytics/weekly?weeks=${WEEK_COUNT}&today=${todayKey}` : null,
  );
  const monthlyState = useApiData<MonthlyResponse>(
    periodMode === 'monthly' ? `/analytics/monthly?months=${MONTH_COUNT}&today=${todayKey}` : null,
  );

  const buildWeeklyPoints = (response: WeeklyResponse): BarPoint[] => {
    const summaryByWeek = new Map(response.weeks.map((week) => [week.weekStart, week]));
    const weekKeys = listRecentWeekKeys(WEEK_COUNT);
    return weekKeys.map((weekKey, index) => ({
      label: formatShortDate(weekKey),
      value: metricValueOf(summaryByWeek.get(weekKey), metricMode),
      isCurrent: index === weekKeys.length - 1,
    }));
  };

  const buildMonthlyPoints = (response: MonthlyResponse): BarPoint[] => {
    const summaryByMonth = new Map(response.months.map((month) => [month.month, month]));
    const monthKeys = listRecentMonthKeys(MONTH_COUNT);
    return monthKeys.map((monthKey, index) => ({
      label: `${Number(monthKey.slice(5))}月`,
      value: metricValueOf(summaryByMonth.get(monthKey), metricMode),
      isCurrent: index === monthKeys.length - 1,
    }));
  };

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
      {periodMode === 'weekly' ? (
        <Loadable state={weeklyState}>
          {(response) => (
            <BarChart points={buildWeeklyPoints(response)} formatValue={metricFormatter(metricMode)} />
          )}
        </Loadable>
      ) : (
        <Loadable state={monthlyState}>
          {(response) => (
            <BarChart points={buildMonthlyPoints(response)} formatValue={metricFormatter(metricMode)} />
          )}
        </Loadable>
      )}
    </Section>
  );
};
