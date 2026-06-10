export const parseNumber = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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
