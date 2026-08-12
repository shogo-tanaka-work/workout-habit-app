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

// 推定1RM は「1RM = weight * (1 + reps / 除数)」の形で、除数だけが種目で変わる。
// どの除数を使うかは utils/oneRepMax.ts が決める（BIG3 は FWJ の換算表に合わせる）。
export const EPLEY_DIVISOR = 30;

// 推定1RM（1 rep max）。除数の既定は Epley 式。
export const estimateOneRepMax = (
  weightKg: number,
  reps: number,
  divisor: number = EPLEY_DIVISOR,
): number => {
  if (weightKg <= 0 || reps <= 0) {
    return 0;
  }
  return Math.round(weightKg * (1 + reps / divisor) * 10) / 10;
};

// 逆算。1RM から「指定レップ数を挙げられる目安重量」を求める（0.5kg 刻み）。
export const weightForReps = (
  oneRepMax: number,
  reps: number,
  divisor: number = EPLEY_DIVISOR,
): number => {
  if (oneRepMax <= 0 || reps <= 0) {
    return 0;
  }
  return Math.round((oneRepMax / (1 + reps / divisor)) * 2) / 2;
};
