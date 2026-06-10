// プレート計算機（Phase 2）。目標重量とバー重量から片側に付けるプレートを貪欲法で求める。

// ジムにある標準的なプレートの重量（kg）。重い順。
const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

export type PlateCount = {
  weightKg: number;
  count: number;
};

export type PlateResult = {
  // 片側に付けるプレートの組み合わせ（重い順）。
  perSide: PlateCount[];
  // 標準プレートで組めない端数（片側あたり、kg）。0なら過不足なし。
  remainderKg: number;
};

export const calculatePlates = (targetWeightKg: number, barWeightKg: number): PlateResult => {
  let remaining = Math.max(0, (targetWeightKg - barWeightKg) / 2);
  const perSide: PlateCount[] = [];
  for (const plate of STANDARD_PLATES_KG) {
    const count = Math.floor(remaining / plate);
    if (count > 0) {
      perSide.push({ weightKg: plate, count });
      remaining = Math.round((remaining - plate * count) * 1000) / 1000;
    }
  }
  return { perSide, remainderKg: remaining };
};

export const formatPlateResult = (result: PlateResult): string => {
  if (result.perSide.length === 0) {
    return 'プレートなし（バーのみ）';
  }
  return result.perSide.map((plate) => `${plate.weightKg}kg×${plate.count}`).join(' ・ ');
};
