// 部位 ID → 識別色（CSS カスタムプロパティ）・表示名の対応。
//
// 部位色の正本は .agents/DESIGN.md「カテゴリ色（部位）」。実装上の値は
// apps/mobile/src/styles/theme.ts の bodyPartColors と styles.css の --body-part-* が
// 同じ値を保つ（片方だけ変えない）。部位の ID と名前は共有プリセット
// （apps/mobile/src/db/seed.ts の seedBodyParts）と同じ内容を保つ。

const PRESET_BODY_PART_IDS = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'cardio',
] as const;

export type PresetBodyPartId = (typeof PRESET_BODY_PART_IDS)[number];

const isPresetBodyPartId = (bodyPartId: string): bodyPartId is PresetBodyPartId =>
  (PRESET_BODY_PART_IDS as readonly string[]).includes(bodyPartId);

/** 凡例・ツールチップに出す部位名。seedBodyParts と同じ内容を保つ。 */
const BODY_PART_LABELS: Record<PresetBodyPartId, string> = {
  chest: '胸',
  back: '背中',
  legs: '脚',
  shoulders: '肩',
  arms: '腕',
  core: '体幹',
  cardio: '有酸素',
};

/**
 * 部位色の CSS カスタムプロパティ名を返す。
 * 未知・未分類の部位は色で意味を主張しないよう unknown（微文字色）へ寄せる。
 */
export const bodyPartColorVariable = (bodyPartId: string | null): string =>
  bodyPartId !== null && isPresetBodyPartId(bodyPartId)
    ? `--body-part-${bodyPartId}`
    : '--body-part-unknown';

/** 部位名を返す。未知・未分類は「その他」に寄せる（画面ごとに決めさせない）。 */
export const bodyPartLabelOf = (bodyPartId: string | null): string =>
  bodyPartId !== null && isPresetBodyPartId(bodyPartId) ? BODY_PART_LABELS[bodyPartId] : 'その他';
