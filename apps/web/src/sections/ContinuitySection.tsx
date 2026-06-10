import { loadWeeklyGoal, saveWeeklyGoal } from '../api';
import { useState } from 'react';

import { volumeByDateKey, weeklyStreak } from '../data/analytics';
import type { Dataset } from '../types/domain';
import { CalendarHeatmap } from '../components/CalendarHeatmap';
import { Section } from '../components/Section';
import { weekKeyOf, formatDateKey } from '../utils/datetime';

// 継続状況: 週連続記録・今週の目標進捗・直近16週のヒートマップ。

type ContinuitySectionProps = {
  dataset: Dataset;
};

const WEEKLY_GOAL_CHOICES = [1, 2, 3, 4, 5, 6, 7];

export const ContinuitySection = ({ dataset }: ContinuitySectionProps) => {
  const [weeklyGoal, setWeeklyGoal] = useState(loadWeeklyGoal);

  const currentWeekKey = weekKeyOf(formatDateKey(new Date()));
  const currentWeekCount = dataset.sessions.filter(
    (session) => weekKeyOf(session.dateKey) === currentWeekKey,
  ).length;
  const streak = weeklyStreak(dataset.sessions);
  const totalWorkouts = dataset.sessions.length;
  const lastSession = dataset.sessions[dataset.sessions.length - 1];
  const goalRatio = Math.min(currentWeekCount / weeklyGoal, 1);

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
      <div className="metric-row">
        <div className="metric">
          <span className="metric-value">{streak}</span>
          <span className="metric-label">週連続</span>
        </div>
        <div className="metric">
          <span className="metric-value">
            {currentWeekCount}
            <span className="metric-unit">/{weeklyGoal}回</span>
          </span>
          <span className="metric-label">今週の実施</span>
        </div>
        <div className="metric">
          <span className="metric-value">{totalWorkouts}</span>
          <span className="metric-label">累計ワークアウト</span>
        </div>
        <div className="metric">
          <span className="metric-value">{lastSession ? lastSession.dateKey.slice(5) : '—'}</span>
          <span className="metric-label">最終実施日</span>
        </div>
      </div>
      <div className="goal-bar">
        <div className="goal-bar-fill" style={{ width: `${goalRatio * 100}%` }} />
      </div>
      <CalendarHeatmap volumeMap={volumeByDateKey(dataset.sessions)} />
    </Section>
  );
};
