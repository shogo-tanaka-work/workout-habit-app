import { useState } from 'react';

import { loadWeeklyGoal, saveWeeklyGoal } from '../api';
import { CalendarHeatmap } from '../components/CalendarHeatmap';
import { Loadable } from '../components/Loadable';
import { Section } from '../components/Section';
import { useApiData } from '../hooks/useApiData';
import type { DailyResponse, HabitResponse } from '../types/api';
import { formatDateKey, formatShortDate } from '../utils/datetime';

// 継続状況: 週連続記録・今週の目標進捗・直近16週のヒートマップ。
// 集計は /analytics/habit と /analytics/daily に委ね、週間目標だけローカル設定。

const WEEKLY_GOAL_CHOICES = [1, 2, 3, 4, 5, 6, 7];
const HEATMAP_WEEKS = 16;
const STREAK_LOOKBACK_WEEKS = 53; // API の上限。これ以上の連続記録は「53+」と表示する

export const ContinuitySection = () => {
  const [weeklyGoal, setWeeklyGoal] = useState(loadWeeklyGoal);
  const todayKey = formatDateKey(new Date());
  const habitState = useApiData<HabitResponse>(
    `/analytics/habit?weeks=${STREAK_LOOKBACK_WEEKS}&today=${todayKey}`,
  );
  const dailyState = useApiData<DailyResponse>(
    `/analytics/daily?weeks=${HEATMAP_WEEKS}&today=${todayKey}`,
  );

  const handleGoalChange = (nextGoal: number): void => {
    setWeeklyGoal(nextGoal);
    saveWeeklyGoal(nextGoal);
  };

  return (
    <Section
      title="継続状況"
      subtitle="週1回以上の実施が続いている週数と、今週の目標進捗"
      actions={
        <label className="goal-select">
          週の目標
          <select
            value={weeklyGoal}
            onChange={(event) => handleGoalChange(Number(event.target.value))}
          >
            {WEEKLY_GOAL_CHOICES.map((choice) => (
              <option key={choice} value={choice}>
                {choice}回
              </option>
            ))}
          </select>
        </label>
      }
    >
      <Loadable state={habitState}>
        {(habit) => (
          <Loadable state={dailyState}>
            {(daily) => {
              const goalRatio = Math.min(habit.thisWeekCount / weeklyGoal, 1);
              const streakLabel =
                habit.currentStreakWeeks >= STREAK_LOOKBACK_WEEKS
                  ? `${STREAK_LOOKBACK_WEEKS}+`
                  : String(habit.currentStreakWeeks);
              const volumeMap = new Map(
                daily.days.map((day) => [day.date, day.totalVolume]),
              );
              return (
                <>
                  <div className="metric-row">
                    <div className="metric">
                      <span className="metric-value">{streakLabel}</span>
                      <span className="metric-label">週連続</span>
                    </div>
                    <div className="metric">
                      <span className="metric-value">
                        {habit.thisWeekCount}
                        <span className="metric-unit">/{weeklyGoal}回</span>
                      </span>
                      <span className="metric-label">今週の実施</span>
                    </div>
                    <div className="metric">
                      <span className="metric-value">{daily.totalWorkouts}</span>
                      <span className="metric-label">累計ワークアウト</span>
                    </div>
                    <div className="metric">
                      <span className="metric-value">
                        {habit.lastWorkoutDate ? formatShortDate(habit.lastWorkoutDate) : '—'}
                      </span>
                      <span className="metric-label">最終実施日</span>
                    </div>
                  </div>
                  <div className="goal-bar">
                    <div className="goal-bar-fill" style={{ width: `${goalRatio * 100}%` }} />
                  </div>
                  <CalendarHeatmap volumeMap={volumeMap} weekCount={HEATMAP_WEEKS} />
                </>
              );
            }}
          </Loadable>
        )}
      </Loadable>
    </Section>
  );
};
