// 依存ライブラリなしの軽量 SVG 折れ線グラフ（モバイル側 TrendChart と同方針）。

export type LinePoint = {
  label: string;
  value: number;
};

type LineChartProps = {
  points: LinePoint[];
  color?: string;
  // 体重のように変化幅が小さい系列は false にして非ゼロ基準で描く。
  scaleFromZero?: boolean;
  formatValue?: (value: number) => string;
};

const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 200;
const PADDING_X = 8;
const PADDING_Y = 16;

const defaultFormat = (value: number): string => String(Math.round(value));

export const LineChart = ({
  points,
  color = 'var(--accent)',
  scaleFromZero = true,
  formatValue = defaultFormat,
}: LineChartProps) => {
  if (points.length < 2) {
    return <p className="chart-empty">グラフ表示には2回以上の記録が必要です</p>;
  }

  const values = points.map((point) => point.value);
  const maxValue = Math.max(...values);
  const minValue = scaleFromZero ? 0 : Math.min(...values);
  const valueRange = maxValue - minValue || 1;

  const innerWidth = VIEW_WIDTH - PADDING_X * 2;
  const innerHeight = VIEW_HEIGHT - PADDING_Y * 2;
  const xAt = (index: number): number =>
    PADDING_X + (points.length === 1 ? 0 : (index / (points.length - 1)) * innerWidth);
  const yAt = (value: number): number =>
    PADDING_Y + innerHeight - ((value - minValue) / valueRange) * innerHeight;

  const polylinePoints = points
    .map((point, index) => `${xAt(index).toFixed(1)},${yAt(point.value).toFixed(1)}`)
    .join(' ');
  const lastPoint = points[points.length - 1];

  return (
    <div className="chart">
      <div className="chart-scale">
        <span>{formatValue(maxValue)}</span>
        <span>{formatValue(minValue)}</span>
      </div>
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" className="chart-svg">
        <line
          x1={PADDING_X}
          y1={VIEW_HEIGHT - PADDING_Y}
          x2={VIEW_WIDTH - PADDING_X}
          y2={VIEW_HEIGHT - PADDING_Y}
          stroke="var(--hairline)"
        />
        <polyline points={polylinePoints} fill="none" stroke={color} strokeWidth={2.5} />
        {points.map((point, index) => (
          <circle
            key={`${point.label}-${index}`}
            cx={xAt(index)}
            cy={yAt(point.value)}
            r={3}
            fill={color}
          />
        ))}
      </svg>
      <div className="chart-axis">
        <span>{points[0].label}</span>
        <span className="chart-last-value">
          {lastPoint.label}: {formatValue(lastPoint.value)}
        </span>
      </div>
    </div>
  );
};
