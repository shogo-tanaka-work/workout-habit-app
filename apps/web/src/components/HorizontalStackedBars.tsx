import type { ChartData, ChartOptions, TooltipModel } from 'chart.js';
import { useRef } from 'react';
import { Bar } from 'react-chartjs-2';

import './chartSetup';

// 横向き積み上げバーの一覧（部位別ボリューム用）。
//
// 行ごとの「名前 / バー / 合計値」の3カラム構成を保つため、名前と合計は HTML のまま、
// バー部分だけを1つの Chart.js canvas で描く。行の高さ（ROW_HEIGHT）を CSS グリッドと
// canvas 側のカテゴリ数で一致させ、HTML の行とバーの行を揃える。
//
// ツールチップは Chart.js 内蔵（canvas 内に描く）だと行数が少ないとき canvas に収まらず
// 切れるため、external で DOM 要素として出す。

export type StackedBarSegment = {
  label: string;
  value: number;
  color: string;
};

export type StackedBarRow = {
  key: string;
  name: string;
  segments: StackedBarSegment[];
  /** 右端の合計表示（1行目: 合計値、2行目: 従属情報）。 */
  summaryPrimary: string;
  summarySecondary: string;
};

type HorizontalStackedBarsProps = {
  rows: StackedBarRow[];
  formatValue: (value: number) => string;
};

/** 1行の高さ（px）。HTML の行グリッドと canvas のカテゴリ高さの両方がこの値を使う。 */
const ROW_HEIGHT = 40;
const BAR_THICKNESS = 14;

/** 行×積み上げ位置の2次元を Chart.js のデータセット（積み上げ位置ごと）へ組み替える。 */
const buildStackedData = (rows: StackedBarRow[]): ChartData<'bar', number[], string> => {
  const segmentCount = Math.max(...rows.map((row) => row.segments.length), 0);
  return {
    labels: rows.map((row) => row.name),
    datasets: Array.from({ length: segmentCount }, (_, segmentIndex) => ({
      data: rows.map((row) => row.segments[segmentIndex]?.value ?? 0),
      backgroundColor: rows.map((row) => row.segments[segmentIndex]?.color ?? 'transparent'),
      barThickness: BAR_THICKNESS,
    })),
  };
};

export const HorizontalStackedBars = ({ rows, formatValue }: HorizontalStackedBarsProps) => {
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = (tooltip: TooltipModel<'bar'>): void => {
    const tooltipElement = tooltipRef.current;
    if (!tooltipElement) {
      return;
    }
    if (tooltip.opacity === 0) {
      tooltipElement.style.opacity = '0';
      return;
    }
    tooltipElement.textContent = tooltip.body.flatMap((body) => body.lines).join(' ');
    // 中央寄せ（translate -50%）のまま端で見切れないよう、左右をコンテナ内へクランプする。
    const containerWidth = tooltipElement.parentElement?.clientWidth ?? 0;
    const halfWidth = tooltipElement.offsetWidth / 2;
    const clampedX = Math.min(Math.max(tooltip.caretX, halfWidth), containerWidth - halfWidth);
    tooltipElement.style.left = `${clampedX}px`;
    tooltipElement.style.top = `${tooltip.caretY}px`;
    tooltipElement.style.opacity = '1';
  };

  // 全行が同じ最大値を分母にすることで、バーの長さを行間で比較できるようにする。
  const maxTotalVolume = Math.max(
    ...rows.map((row) => row.segments.reduce((sum, segment) => sum + segment.value, 0)),
    1,
  );

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      tooltip: {
        enabled: false,
        external: (context) => showTooltip(context.tooltip),
        callbacks: {
          label: (item) => {
            const segment = rows[item.dataIndex]?.segments[item.datasetIndex];
            return segment ? `${segment.label} ${formatValue(segment.value)}` : '';
          },
        },
        filter: (item) => (item.parsed.x ?? 0) > 0,
      },
    },
    scales: {
      x: { stacked: true, display: false, beginAtZero: true, max: maxTotalVolume },
      y: { stacked: true, display: false },
    },
  };

  return (
    <div
      className="hbar-chart"
      style={{ gridTemplateRows: `repeat(${rows.length}, ${ROW_HEIGHT}px)` }}
    >
      {rows.map((row, rowIndex) => (
        <span key={row.key} className="hbar-name" style={{ gridRow: rowIndex + 1 }}>
          {row.name}
        </span>
      ))}
      <div className="hbar-canvas" style={{ gridRow: `1 / ${rows.length + 1}` }}>
        <Bar data={buildStackedData(rows)} options={options} />
        <div ref={tooltipRef} className="hbar-tooltip" role="status" />
      </div>
      {rows.map((row, rowIndex) => (
        <span key={row.key} className="hbar-value" style={{ gridRow: rowIndex + 1 }}>
          {row.summaryPrimary}
          <span className="hbar-sets">{row.summarySecondary}</span>
        </span>
      ))}
    </div>
  );
};
