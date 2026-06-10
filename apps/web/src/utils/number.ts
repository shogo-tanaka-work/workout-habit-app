// 数値計算・表示の純粋関数。

// Epley 式: 1RM = weight * (1 + reps / 30)
const EPLEY_DIVISOR = 30;

export const estimateOneRepMax = (weightKg: number, reps: number): number =>
  reps <= 1 ? weightKg : weightKg * (1 + reps / EPLEY_DIVISOR);

export const safeDivide = (numerator: number, denominator: number, fallback = 0): number =>
  denominator > 0 ? numerator / denominator : fallback;

// 12,340kg のような桁区切り付きボリューム表記。
export const formatVolume = (volumeKg: number): string =>
  `${Math.round(volumeKg).toLocaleString('ja-JP')}kg`;

// 重量は小数1桁まで（80 / 72.5 のように末尾ゼロは省く）。
export const formatWeight = (weightKg: number): string =>
  `${Number(weightKg.toFixed(1))}kg`;
