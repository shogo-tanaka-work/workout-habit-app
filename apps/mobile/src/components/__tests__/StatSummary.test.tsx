import { render, screen } from '@testing-library/react-native';

import { StatSummary } from '../StatSummary';

describe('StatSummary', () => {
  it('主役の数値と単位を出す', () => {
    render(
      <StatSummary primary={{ label: '総ボリューム', value: '12,340', unit: 'kg' }} items={[]} />,
    );
    expect(screen.getByText('12,340')).toBeTruthy();
    expect(screen.getByText('kg')).toBeTruthy();
    expect(screen.getByText('総ボリューム')).toBeTruthy();
  });

  it('単位が無ければ付けない', () => {
    render(<StatSummary primary={{ label: 'セット', value: '12' }} items={[]} />);
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('従属指標を並べ、2件目以降に区切りを入れる', () => {
    render(
      <StatSummary
        primary={{ label: '総ボリューム', value: '12,340', unit: 'kg' }}
        items={[
          { label: 'セット', value: '12' },
          { label: '総レップ', value: '96', unit: '回' },
        ]}
      />,
    );
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('96回')).toBeTruthy();
    expect(screen.getAllByText('・')).toHaveLength(1);
  });
});
