// Chart.js の登録。auto 登録（'chart.js/auto'）は全機能をバンドルへ入れてしまうため使わず、
// 実際に描く折れ線・バーに必要なコントローラ・要素・スケールだけを register する。
// このモジュールを import した時点で登録が済む（各チャートコンポーネントが side-effect import する）。

import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
);

// canvas 内の文字は CSS を継承しないため、ここで既定を与える。
// フォントは styles.css の body、サイズは --font-xs と同じ値を保つ（片方だけ変えない）。
Chart.defaults.font.family =
  "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', system-ui, sans-serif";
Chart.defaults.font.size = 12;
