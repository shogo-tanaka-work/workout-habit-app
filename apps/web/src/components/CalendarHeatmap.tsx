import type { CSSProperties } from 'react';

import { addDays, formatDateKey, formatShortDate, mondayOf } from '../utils/datetime';
import { bodyPartColorVariable, bodyPartLabelOf } from '../utils/bodyParts';
import { formatVolume } from '../utils/number';

// 直近 N 週の実施状況を GitHub 風のヒートマップで表示する（自作コンポーネントのまま）。
// 列 = 週（左が過去）、行 = 曜日（月〜日）。
//
// セルの色はその日の最大ボリューム部位（topBodyPartId）の部位色。強度はボリュームに応じた
// 不透明度で表す。topBodyPartId が来ない旧 API のレスポンスでは、従来どおり
// アクセント色の濃淡クラスへフォールバックする（デプロイ順の自由度のため）。

export type HeatmapDay = {
  totalVolume: number;
  /** その日の最大ボリューム部位。undefined は旧 API（フィールドなし）。 */
  topBodyPartId?: string | null;
};

type CalendarHeatmapProps = {
  dayMap: Map<string, HeatmapDay>;
  weekCount?: number;
};

const DAYS_PER_WEEK = 7;
const WEEKDAY_LABELS = ['月', '', '水', '', '金', '', '日'];
const DEFAULT_WEEK_COUNT = 16;

// ボリュームに応じた4段階の濃淡（旧 API フォールバック用）。
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

// 部位色セルの不透明度（3段階）。色相は部位、濃さはボリュームを表す。
const intensityOpacity = (volume: number, maxVolume: number): number => {
  const ratio = volume / maxVolume;
  if (ratio > 0.66) {
    return 1;
  }
  if (ratio > 0.33) {
    return 0.7;
  }
  return 0.45;
};

/**
 * 週列ごとの月ラベル。月が変わった列に「6月」のように出す。
 * 先頭列にも出すが、直後の列で月が変わる場合は重なりを避けて省く。
 */
const buildMonthLabels = (weekColumns: string[][]): string[] => {
  const monthOf = (dateKey: string): number => Number(dateKey.slice(5, 7));
  return weekColumns.map((days, index) => {
    const month = monthOf(days[0]);
    if (index === 0) {
      const nextColumn = weekColumns[1];
      return nextColumn && monthOf(nextColumn[0]) !== month ? '' : `${month}月`;
    }
    return month !== monthOf(weekColumns[index - 1][0]) ? `${month}月` : '';
  });
};

const cellStyle = (day: HeatmapDay, maxVolume: number): CSSProperties => ({
  background: `var(${bodyPartColorVariable(day.topBodyPartId ?? null)})`,
  opacity: intensityOpacity(day.totalVolume, maxVolume),
});

export const CalendarHeatmap = ({
  dayMap,
  weekCount = DEFAULT_WEEK_COUNT,
}: CalendarHeatmapProps) => {
  const todayKey = formatDateKey(new Date());
  const firstMonday = addDays(mondayOf(new Date()), -(weekCount - 1) * DAYS_PER_WEEK);
  const days = [...dayMap.values()];
  const maxVolume = Math.max(...days.map((day) => day.totalVolume), 1);
  // 1日でも topBodyPartId が来ていれば新 API とみなし、部位色で塗る。
  const hasBodyPartInfo = days.some((day) => day.topBodyPartId !== undefined);

  const weekColumns: string[][] = [];
  for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
    const columnDays: string[] = [];
    for (let dayIndex = 0; dayIndex < DAYS_PER_WEEK; dayIndex += 1) {
      columnDays.push(formatDateKey(addDays(firstMonday, weekIndex * DAYS_PER_WEEK + dayIndex)));
    }
    weekColumns.push(columnDays);
  }
  const monthLabels = buildMonthLabels(weekColumns);

  // 凡例は表示期間に実際に出てくる部位だけを、初出順で並べる（色変数単位で重複排除）。
  const legendItems = hasBodyPartInfo
    ? [
        ...new Map(
          days
            .filter((day) => day.totalVolume > 0)
            .map((day) => day.topBodyPartId ?? null)
            .map((bodyPartId) => [bodyPartColorVariable(bodyPartId), bodyPartId] as const),
        ).entries(),
      ]
    : [];

  const renderCell = (dateKey: string) => {
    const day = dayMap.get(dateKey);
    const volume = day?.totalVolume ?? 0;
    if (dateKey > todayKey) {
      return <span key={dateKey} className="heatmap-cell heatmap-future" />;
    }
    const partLabel =
      day && hasBodyPartInfo && volume > 0 ? `（${bodyPartLabelOf(day.topBodyPartId ?? null)}）` : '';
    const title =
      volume > 0
        ? `${formatShortDate(dateKey)}: ${formatVolume(volume)}${partLabel}`
        : formatShortDate(dateKey);
    if (day && hasBodyPartInfo && volume > 0) {
      return (
        <span
          key={dateKey}
          title={title}
          className="heatmap-cell"
          style={cellStyle(day, maxVolume)}
        />
      );
    }
    return <span key={dateKey} title={title} className={intensityClass(volume, maxVolume)} />;
  };

  return (
    <div>
      <div className="heatmap">
        <div className="heatmap-weekdays">
          <span className="heatmap-month-spacer" />
          {WEEKDAY_LABELS.map((label, index) => (
            <span key={index} className="heatmap-weekday">
              {label}
            </span>
          ))}
        </div>
        <div>
          <div className="heatmap-months">
            {monthLabels.map((label, index) => (
              <span key={weekColumns[index][0]} className="heatmap-month">
                {label}
              </span>
            ))}
          </div>
          <div className="heatmap-grid">
            {weekColumns.map((columnDays) => (
              <div key={columnDays[0]} className="heatmap-week">
                {columnDays.map(renderCell)}
              </div>
            ))}
          </div>
        </div>
      </div>
      {legendItems.length > 0 ? (
        <div className="heatmap-legend">
          {legendItems.map(([colorVariable, bodyPartId]) => (
            <span key={colorVariable} className="heatmap-legend-item">
              <span className="heatmap-legend-dot" style={{ background: `var(${colorVariable})` }} />
              {bodyPartLabelOf(bodyPartId)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};
