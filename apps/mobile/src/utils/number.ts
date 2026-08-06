export const parseNumber = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// 桁区切りを付けた整数表記。単位を別の Text として描画するときに使う。
export const formatCount = (value: number): string => Math.round(value).toLocaleString('ja-JP');

// 12,340kg のような桁区切り付きボリューム表記。apps/web の utils/number.ts と同じ表記に揃える。
export const formatVolume = (volumeKg: number): string => `${formatCount(volumeKg)}kg`;

// 重量は小数1桁まで（80 / 72.5 のように末尾ゼロは省く）。
export const formatWeight = (weightKg: number): string => `${Number(weightKg.toFixed(1))}kg`;

// Epley 式の係数。1RM = weight * (1 + reps / EPLEY_DIVISOR)。
const EPLEY_DIVISOR = 30;

// Epley 式による推定1RM（1 rep max）。
export const estimateOneRepMax = (weightKg: number, reps: number): number => {
  if (weightKg <= 0 || reps <= 0) {
    return 0;
  }
  return Math.round(weightKg * (1 + reps / EPLEY_DIVISOR) * 10) / 10;
};

// Epley 式の逆算。1RM から「指定レップ数を挙げられる目安重量」を求める（0.5kg 刻み）。
export const weightForReps = (oneRepMax: number, reps: number): number => {
  if (oneRepMax <= 0 || reps <= 0) {
    return 0;
  }
  return Math.round((oneRepMax / (1 + reps / EPLEY_DIVISOR)) * 2) / 2;
};
