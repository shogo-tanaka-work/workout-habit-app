import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Text, View } from 'react-native';

import { styles } from '../styles/appStyles';

export type TrendPoint = {
  label: string;
  value: number;
};

const CHART_HEIGHT = 150;
const PLOT_TOP = 8;
const PLOT_BOTTOM = 8;
const Y_LABEL_WIDTH = 52;
const GRID_FRACTIONS = [0, 1 / 3, 2 / 3, 1] as const;
const DOT_SIZE = 7;
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const;

// Y軸の最大値を切りのよい数字へ丸める（目盛りラベルを読みやすくするため）。
const niceCeil = (value: number): number => {
  if (value <= 0) {
    return 1;
  }
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const niceNormalized = NICE_STEPS.find((step) => step >= normalized) ?? 10;
  return niceNormalized * magnitude;
};

const formatAxisValue = (value: number): string => Math.round(value).toLocaleString();

// 外部チャートライブラリを使わず、View の絶対配置で折れ線を描く簡易推移グラフ。
// points は古い→新しい順で渡す。
export function TrendChart({
  title,
  unit,
  points,
  color,
}: {
  title: string;
  unit: string;
  points: TrendPoint[];
  color: string;
}) {
  const [canvasWidth, setCanvasWidth] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    setCanvasWidth(event.nativeEvent.layout.width);
  };

  const plotWidth = Math.max(0, canvasWidth - Y_LABEL_WIDTH);
  const plotHeight = CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM;
  const maxValue = niceCeil(points.reduce((max, point) => Math.max(max, point.value), 0));

  const positions = points.map((point, index) => {
    const ratio = points.length === 1 ? 0.5 : index / (points.length - 1);
    return {
      x: Y_LABEL_WIDTH + ratio * plotWidth,
      y: PLOT_TOP + (1 - point.value / maxValue) * plotHeight,
    };
  });

  const segments = positions.slice(1).map((end, index) => {
    const start = positions[index];
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const length = Math.hypot(deltaX, deltaY);
    return {
      length,
      angle: Math.atan2(deltaY, deltaX),
      centerX: (start.x + end.x) / 2,
      centerY: (start.y + end.y) / 2,
    };
  });

  const xLabelPoints =
    points.length > 4
      ? [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]]
      : points;

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>
          {title}（{unit}）
        </Text>
      </View>
      <View style={styles.chartBody}>
        {points.length < 2 ? (
          <Text style={styles.muted}>記録が2回以上たまると推移を表示します。</Text>
        ) : (
          <>
            <View style={styles.chartCanvas} onLayout={handleLayout}>
              {GRID_FRACTIONS.map((fraction) => (
                <View key={`grid-${fraction}`}>
                  <View style={[styles.chartGridLine, { top: PLOT_TOP + fraction * plotHeight }]} />
                  <Text
                    style={[styles.chartGridLabel, { top: PLOT_TOP + fraction * plotHeight - 7 }]}
                  >
                    {formatAxisValue(maxValue * (1 - fraction))}
                  </Text>
                </View>
              ))}
              {canvasWidth > 0
                ? segments.map((segment, index) => (
                    <View
                      key={`segment-${index}`}
                      style={[
                        styles.chartSegment,
                        {
                          width: segment.length,
                          left: segment.centerX - segment.length / 2,
                          top: segment.centerY - 1,
                          backgroundColor: color,
                          transform: [{ rotate: `${segment.angle}rad` }],
                        },
                      ]}
                    />
                  ))
                : null}
              {canvasWidth > 0
                ? positions.map((position, index) => (
                    <View
                      key={`dot-${index}`}
                      style={[
                        styles.chartDot,
                        {
                          left: position.x - DOT_SIZE / 2,
                          top: position.y - DOT_SIZE / 2,
                          backgroundColor: color,
                        },
                      ]}
                    />
                  ))
                : null}
            </View>
            <View style={[styles.chartXLabels, { marginLeft: Y_LABEL_WIDTH }]}>
              {xLabelPoints.map((point, index) => (
                <Text key={`xlabel-${index}`} style={styles.chartXLabelText}>
                  {point.label}
                </Text>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}
