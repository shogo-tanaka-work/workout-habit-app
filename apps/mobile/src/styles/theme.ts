import { StyleSheet } from 'react-native';

// 参考UI（30_research/参考画面）準拠のダークテーマ定数。
// 暖色系の黒地・ヘアライン罫線・オレンジアクセントを基調にし、
// 角丸カードの多用ではなく表組み（テーブル）と区切り線で情報を構成する。
export const colors = {
  background: '#171411',
  surface: '#1e1a16',
  surfaceRaised: '#27221c',
  hairline: '#393229',
  hairlineStrong: '#4d4437',
  textPrimary: '#ece4d8',
  textSecondary: '#a89d8d',
  textFaint: '#7b7163',
  accent: '#df8a3d',
  accentText: '#f0b375',
  accentSurface: '#332617',
  accentSurfaceStrong: '#6b4a25',
  // アクセント色で塗った面の上に載せる文字色。
  onAccent: '#1f1408',
  danger: '#e0705f',
  dangerSurface: '#2e1b18',
  chartPrimary: '#df8a3d',
  chartSecondary: '#6f9fd8',
};

// 部位の識別色（カテゴリ色）。強弱ではなく「どの部位か」だけを表す。
// 暖色ダーク地の上で色相を見分けられる範囲に彩度を落としてある。
// 詳細は .agents/DESIGN.md「カテゴリ色（部位）」。
export const bodyPartColors: Record<string, string> = {
  chest: '#e07a5f',
  back: '#6f9fd8',
  legs: '#a082cc',
  shoulders: '#77b98a',
  arms: '#c9b458',
  core: '#5fb8b0',
  cardio: '#c97fa8',
};

// 未知・未分類の部位。色で意味を主張しないよう微文字色に寄せる。
export const unknownBodyPartColor = '#7b7163';

export const bodyPartColor = (bodyPartId: string | null | undefined): string =>
  (bodyPartId ? bodyPartColors[bodyPartId] : undefined) ?? unknownBodyPartColor;

export const spacing = {
  // ラベルと値のような、密着させたい組み合わせにだけ使う最小の間隔。
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 48,
};

// ジムで、腕を伸ばした距離から汗をかいた状態で読む前提のスケール。
// 一般的なアプリより一段大きい。小さくしたくなったら、まず情報量を減らす。
export const fontSize = {
  xs: 12,
  sm: 15,
  md: 17,
  lg: 20,
  xl: 24,
  // 画面で1つだけ使う主役の数値（レストタイマー・区画の主指標）。
  display: 30,
};

// 表組み・区切り線に使う極細線。
export const hairlineWidth = StyleSheet.hairlineWidth;

// ボタンなど操作要素にだけ許す控えめな角丸。
export const radius = {
  sm: 6,
  md: 10,
};
