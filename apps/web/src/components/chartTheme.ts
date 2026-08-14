// Chart.js（canvas 描画）へ渡す色の解決。
//
// canvas は CSS カスタムプロパティ（var(--accent) 等）を解釈できないため、
// 色の正本を styles.css に保ったまま、描画時に計算済みスタイルから実値を読む。
// ここを通さずにチャートへ色を直書きしない。

/** styles.css の CSS カスタムプロパティから色の実値（#rrggbb）を読む。 */
export const readCssColor = (variableName: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

/**
 * #rrggbb に不透明度を掛けた rgba() を返す。暗色背景の上では明度違いに見えるため、
 * 積み上げバーの「部位色の濃淡」をこれで作る。#rrggbb 以外はそのまま返す。
 */
export const withAlpha = (hexColor: string, alpha: number): string => {
  if (!HEX_COLOR_PATTERN.test(hexColor)) {
    return hexColor;
  }
  const red = parseInt(hexColor.slice(1, 3), 16);
  const green = parseInt(hexColor.slice(3, 5), 16);
  const blue = parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};
