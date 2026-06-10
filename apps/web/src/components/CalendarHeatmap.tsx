import { addDays, formatDateKey, formatShortDate, mondayOf } from '../utils/datetime';
import { formatVolume } from '../utils/number';

// 直近 N 週の実施状況を GitHub 風のヒートマップで表示する。
// 列 = 週（左が過去）、行 = 曜日（月〜日）。

type CalendarHeatmapProps = {
  volumeMap: Map<string, number>;
  weekCount?: number;
};

const DAYS_PER_WEEK = 7;
const WEEKDAY_LABELS = ['月', '', '水', '', '金', '', '日'];
const DEFAULT_WEEK_COUNT = 16;

// ボリュームに応じた4段階の濃淡。
const intensityClass = (volume: number, maxVolume: number): string => {
  if (volume <= 0) {
    return 'heatmap-cell';
  }
  const ratio = volume / maxVolume;
  if (ratio > 0.66) {
    return 'heatmap-cell heatmap-level-3';
  }
  if (ratio > 0.33) {
    return 'heatmap-cell heatmap-level-2';
  }
  return 'heatmap-cell heatmap-level-1';
};

export const CalendarHeatmap = ({
  volumeMap,
  weekCount = DEFAULT_WEEK_COUNT,
}: CalendarHeatmapProps) => {
  const todayKey = formatDateKey(new Date());
  const firstMonday = addDays(mondayOf(new Date()), -(weekCount - 1) * DAYS_PER_WEEK);
  const maxVolume = Math.max(...volumeMap.values(), 1);

  const weekColumns: string[][] = [];
  for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
    const days: string[] = [];
    for (let dayIndex = 0; dayIndex < DAYS_PER_WEEK; dayIndex += 1) {
      days.push(formatDateKey(addDays(firstMonday, weekIndex * DAYS_PER_WEEK + dayIndex)));
    }
    weekColumns.push(days);
  }

  return (
    <div className="heatmap">
      <div className="heatmap-weekdays">
        {WEEKDAY_LABELS.map((label, index) => (
          <span key={index} className="heatmap-weekday">
            {label}
          </span>
        ))}
      </div>
      <div className="heatmap-grid">
        {weekColumns.map((days) => (
          <div key={days[0]} className="heatmap-week">
            {days.map((dateKey) => {
              const volume = volumeMap.get(dateKey) ?? 0;
              const isFuture = dateKey > todayKey;
              const title =
                volume > 0
                  ? `${formatShortDate(dateKey)}: ${formatVolume(volume)}`
                  : formatShortDate(dateKey);
              return (
                <span
                  key={dateKey}
                  title={title}
                  className={
                    isFuture ? 'heatmap-cell heatmap-future' : intensityClass(volume, maxVolume)
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
