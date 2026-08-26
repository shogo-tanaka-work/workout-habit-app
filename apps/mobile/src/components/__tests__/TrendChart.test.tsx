import { render, screen } from '@testing-library/react-native';

import { TrendChart } from '../TrendChart';

const renderChart = (points: { label: string; value: number }[]) =>
  render(<TrendChart title="総ボリューム推移" unit="kg" points={points} color="#f00" />);

describe('TrendChart', () => {
  it('見出しに単位を添える', () => {
    renderChart([
      { label: '8/20', value: 100 },
      { label: '8/27', value: 200 },
    ]);
    expect(screen.getByText('総ボリューム推移（kg）')).toBeTruthy();
  });

  it('1点だけなら推移を描かず理由を出す', () => {
    renderChart([{ label: '8/27', value: 100 }]);
    expect(screen.getByText('記録が2回以上たまると推移を表示します。')).toBeTruthy();
  });

  it('X軸ラベルを点ごとに出す', () => {
    renderChart([
      { label: '8/20', value: 100 },
      { label: '8/27', value: 200 },
    ]);
    expect(screen.getByText('8/20')).toBeTruthy();
    expect(screen.getByText('8/27')).toBeTruthy();
  });

  it('点が多いときは最初・中央・最後だけラベルを出す', () => {
    renderChart(
      Array.from({ length: 7 }, (_, index) => ({ label: `9/${index + 1}`, value: 100 })),
    );
    expect(screen.getByText('9/1')).toBeTruthy();
    expect(screen.getByText('9/4')).toBeTruthy();
    expect(screen.getByText('9/7')).toBeTruthy();
    expect(screen.queryByText('9/2')).toBeNull();
  });

  it('Y軸は 0 起点にせず、値域に合わせて拡大する', () => {
    renderChart([
      { label: '8/20', value: 90 },
      { label: '8/27', value: 100 },
    ]);
    // 90〜100 の推移で 0 まで目盛りを引くと、変化が読めない一直線になる。
    expect(screen.queryByText('0')).toBeNull();
  });

  it('全点が同じ値でも目盛りを作る', () => {
    renderChart([
      { label: '8/20', value: 70 },
      { label: '8/27', value: 70 },
    ]);
    expect(screen.getByText('総ボリューム推移（kg）')).toBeTruthy();
  });
});
