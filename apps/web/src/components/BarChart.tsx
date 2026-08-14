import type { ChartData, ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';

import './chartSetup';
import { readCssColor } from './chartTheme';

// Chart.js の縦棒グラフ（週次・月次推移用）。
// バーは長さで量を表すため、折れ線と違い 0 起点のまま描く。

export type BarPoint = {
  label: string;
  value: number;
  isCurrent?: boolean;
};

type BarChartProps = {
  points: BarPoint[];
  formatValue?: (value: number) => string;
};

const MAX_Y_TICKS = 6;

const defaultFormat = (value: number): string => String(Math.round(value));

export const BarChart = ({ points, formatValue = defaultFormat }: BarChartProps) => {
  if (points.length === 0) {
    return (
      <p className="chart-empty">
        表示できるデータがありません。アプリで記録すると、同期後にここへ反映されます
      </p>
    );
  }

  const accentColor = readCssColor('--accent');
  const pastBarColor = readCssColor('--accent-surface-strong');
  const faintColor = readCssColor('--text-faint');
  const hairlineColor = readCssColor('--hairline');

  const data: ChartData<'bar', number[], string> = {
    labels: points.map((point) => point.label),
    datasets: [
      {
        data: points.map((point) => point.value),
        backgroundColor: points.map((point) => (point.isCurrent ? accentColor : pastBarColor)),
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (item) => (item.parsed.y === null ? '' : formatValue(item.parsed.y)),
        },
      },
    },
    scales: {
      x: {
        ticks: { color: faintColor, maxRotation: 0, autoSkip: true },
        grid: { display: false },
        border: { color: hairlineColor },
      },
      y: {
        beginAtZero: true,
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
      <Bar data={data} options={options} />
    </div>
  );
};
