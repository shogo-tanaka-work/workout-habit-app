// 依存ライブラリなしの軽量 SVG 縦棒グラフ（週次・月次推移用）。

export type BarPoint = {
  label: string;
  value: number;
  isCurrent?: boolean;
};

type BarChartProps = {
  points: BarPoint[];
  formatValue?: (value: number) => string;
};

const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 200;
const PADDING_TOP = 24;
const PADDING_BOTTOM = 24;
const BAR_GAP_RATIO = 0.3;

const defaultFormat = (value: number): string => String(Math.round(value));

export const BarChart = ({ points, formatValue = defaultFormat }: BarChartProps) => {
  if (points.length === 0) {
    return <p className="chart-empty">表示できるデータがありません</p>;
  }

  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const innerHeight = VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const slotWidth = VIEW_WIDTH / points.length;
  const barWidth = slotWidth * (1 - BAR_GAP_RATIO);
  // ラベルが多いときは間引いて重なりを防ぐ。
  const labelStep = Math.ceil(points.length / 8);

  return (
    <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" className="chart-svg">
      <line
        x1={0}
        y1={VIEW_HEIGHT - PADDING_BOTTOM}
        x2={VIEW_WIDTH}
        y2={VIEW_HEIGHT - PADDING_BOTTOM}
        stroke="var(--hairline)"
      />
      {points.map((point, index) => {
        const barHeight = (point.value / maxValue) * innerHeight;
        const barX = index * slotWidth + (slotWidth - barWidth) / 2;
        const barY = VIEW_HEIGHT - PADDING_BOTTOM - barHeight;
        const showLabel = index % labelStep === 0 || index === points.length - 1;
        const showValue = point.value > 0 && (point.isCurrent || point.value === maxValue);
        return (
          <g key={`${point.label}-${index}`}>
            <rect
              x={barX}
              y={barY}
              width={barWidth}
              height={Math.max(barHeight, point.value > 0 ? 2 : 0)}
              fill={point.isCurrent ? 'var(--accent)' : 'var(--accent-surface-strong)'}
            />
            {showValue ? (
              <text x={barX + barWidth / 2} y={barY - 6} textAnchor="middle" className="chart-text">
                {formatValue(point.value)}
              </text>
            ) : null}
            {showLabel ? (
              <text
                x={barX + barWidth / 2}
                y={VIEW_HEIGHT - 6}
                textAnchor="middle"
                className="chart-text chart-text-faint"
              >
                {point.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
};
