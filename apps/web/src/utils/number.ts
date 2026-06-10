// 数値表示の純粋関数。集計（1RM計算など）は /analytics API 側で行う。

export const safeDivide = (numerator: number, denominator: number, fallback = 0): number =>
  denominator > 0 ? numerator / denominator : fallback;

// 12,340kg のような桁区切り付きボリューム表記。
export const formatVolume = (volumeKg: number): string =>
  `${Math.round(volumeKg).toLocaleString('ja-JP')}kg`;

// 重量は小数1桁まで（80 / 72.5 のように末尾ゼロは省く）。
export const formatWeight = (weightKg: number): string =>
  `${Number(weightKg.toFixed(1))}kg`;
