import type { ChartData, ChartOptions, Plugin } from 'chart.js';
import { Line } from 'react-chartjs-2';

import './chartSetup';
import { readCssColor } from './chartTheme';

// Chart.js の折れ線グラフ（種目別推移・ボディログ用）。
//
// 縦軸はデータ範囲基準で描く（DESIGN.md「縦軸は 0 を基準にしない」）。
// Chart.js の linear スケールは既定で 0 起点にならず、grace で上下に余白を足して
// 表示範囲を使い切る。目標線（goalValue）はデータセットとして描くため、
// スケール計算に自動で含まれ、目標が値域の外でも線が見える。

export type LinePoint = {
  label: string;
  value: number;
  /** YYYY-MM-DD。月平均の補助線に使う。無い点が1つでもあれば補助線は描かない。 */
  dateKey?: string;
};

/**
 * 各点へ「その点が属する月の平均」を割り当てた系列。段状に描くと月単位の水準の
 * 増減が読める（全期間一本の平均線では伸びているか落ちているかが読めない）。
 * 表示中の点から出す値であり、集計ではなく表示整形（トレンド線）の範囲。
 */
const buildMonthlyAverages = (points: LinePoint[]): number[] | null => {
  const monthKeys: string[] = [];
  for (const point of points) {
    if (point.dateKey === undefined) {
      return null;
    }
    monthKeys.push(point.dateKey.slice(0, 7));
  }
  const totalByMonth = new Map<string, { sum: number; count: number }>();
  points.forEach((point, index) => {
    const entry = totalByMonth.get(monthKeys[index]) ?? { sum: 0, count: 0 };
    entry.sum += point.value;
    entry.count += 1;
    totalByMonth.set(monthKeys[index], entry);
  });
  return monthKeys.map((monthKey) => {
    const entry = totalByMonth.get(monthKey) ?? { sum: 0, count: 1 };
    return entry.sum / entry.count;
  });
};

type LineChartProps = {
  points: LinePoint[];
  /** 系列色の CSS カスタムプロパティ名。canvas へは実値へ解決して渡す。 */
  colorVariable?: string;
  formatValue?: (value: number) => string;
  /** 水平の目標線（破線・第2系列色）。null なら描かない。 */
  goalValue?: number | null;
};

/** 縦軸の余白（データ範囲に対する割合）。0 起点をやめた分、線が枠に張り付かないようにする。 */
const AXIS_GRACE = '10%';
const MAX_Y_TICKS = 7;
const MAX_X_TICKS = 8;

const defaultFormat = (value: number): string => String(Math.round(value));

export const LineChart = ({
  points,
  colorVariable = '--chart-primary',
  formatValue = defaultFormat,
  goalValue = null,
}: LineChartProps) => {
  if (points.length < 2) {
    return <p className="chart-empty">グラフ表示には2回以上の記録が必要です</p>;
  }

  const lineColor = readCssColor(colorVariable);
  const goalColor = readCssColor('--chart-secondary');
  const faintColor = readCssColor('--text-faint');
  const hairlineColor = readCssColor('--hairline');

  const monthlyAverages = buildMonthlyAverages(points);

  // 月平均線の右端へ「月平均 xx」（最新月の値）を描く。datalabels 系のプラグインは
  // 追加しない方針のため、この1テキストだけ自前で描画する。
  const averageLabelPlugin: Plugin<'line'> = {
    id: 'averageLabel',
    afterDatasetsDraw: (chart) => {
      const yScale = chart.scales.y;
      if (!yScale || monthlyAverages === null || monthlyAverages.length === 0) {
        return;
      }
      const latestAverage = monthlyAverages[monthlyAverages.length - 1];
      const yPixel = yScale.getPixelForValue(latestAverage);
      const labelY = Math.max(yPixel - 4, chart.chartArea.top + 12);
      const context = chart.ctx;
      context.save();
      context.font = '11px sans-serif';
      context.fillStyle = faintColor;
      context.textAlign = 'right';
      context.textBaseline = 'bottom';
      context.fillText(`月平均 ${formatValue(latestAverage)}`, chart.chartArea.right - 4, labelY);
      context.restore();
    },
  };

  const data: ChartData<'line', number[], string> = {
    labels: points.map((point) => point.label),
    datasets: [
      {
        data: points.map((point) => point.value),
        borderColor: lineColor,
        backgroundColor: lineColor,
        borderWidth: 2.5,
        pointRadius: 2.5,
      },
      ...(goalValue !== null
        ? [
            {
              data: points.map(() => goalValue),
              borderColor: goalColor,
              backgroundColor: goalColor,
              borderWidth: 1.5,
              borderDash: [6, 6],
              pointRadius: 0,
            },
          ]
        : []),
      ...(monthlyAverages !== null
        ? [
            {
              // 月平均（段状）。目標線（長い破線・第2系列色）と見分けられるよう、細い短破線にする。
              data: monthlyAverages,
              borderColor: faintColor,
              backgroundColor: faintColor,
              borderWidth: 1,
              borderDash: [3, 4],
              pointRadius: 0,
              stepped: true as const,
            },
          ]
        : []),
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      tooltip: {
        // 目標線は一定値の補助線なので、ツールチップは実データの系列だけに出す。
        filter: (item) => item.datasetIndex === 0,
        callbacks: {
          label: (item) => (item.parsed.y === null ? '' : formatValue(item.parsed.y)),
        },
      },
    },
    scales: {
      x: {
        ticks: { color: faintColor, maxRotation: 0, autoSkip: true, maxTicksLimit: MAX_X_TICKS },
        grid: { display: false },
        border: { color: hairlineColor },
      },
      y: {
        grace: AXIS_GRACE,
        ticks: {
          color: faintColor,
          maxTicksLimit: MAX_Y_TICKS,
          callback: (value) => formatValue(Number(value)),
        },
        grid: { color: hairlineColor },
        border: { display: false },
      },
    },
  };

  return (
    <div className="chart-canvas">
      <Line data={data} options={options} plugins={[averageLabelPlugin]} />
    </div>
  );
};
