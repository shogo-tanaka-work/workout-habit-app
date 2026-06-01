export const parseNumber = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// Epley 式による推定1RM（1 rep max）。weightKg * (1 + reps / 30)。
export const estimateOneRepMax = (weightKg: number, reps: number): number => {
  if (weightKg <= 0 || reps <= 0) {
    return 0;
  }
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
};
