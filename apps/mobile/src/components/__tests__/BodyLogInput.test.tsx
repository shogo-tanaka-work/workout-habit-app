import { fireEvent, render, screen } from '@testing-library/react-native';

import type { BodyLog } from '../../types/domain';
import { BodyLogInput } from '../BodyLogInput';

const log: BodyLog = {
  id: 'b1',
  measuredAt: '2026-08-27',
  bodyWeightKg: 70.5,
  bodyFatPercentage: 18,
  memo: '',
};

describe('BodyLogInput', () => {
  it('その日の記録があれば見出しに出し、上書き保存にする', () => {
    render(
      <BodyLogInput date="2026-08-27" log={log} latestLog={log} onSave={jest.fn()} />,
    );
    expect(screen.getByText('70.5 kg ・ 18%')).toBeTruthy();
    expect(screen.getByText('上書き保存')).toBeTruthy();
  });

  it('未記録の日は直近の値を初期値にする', () => {
    render(<BodyLogInput date="2026-08-28" log={null} latestLog={log} onSave={jest.fn()} />);
    expect(screen.getByText('この日は未記録')).toBeTruthy();
    expect(screen.getByText('この日の値を保存')).toBeTruthy();
    expect(screen.getByDisplayValue('70.5')).toBeTruthy();
  });

  it('選んだ日の値として保存する', () => {
    const onSave = jest.fn();
    render(<BodyLogInput date="2026-08-28" log={null} latestLog={log} onSave={onSave} />);

    fireEvent.press(screen.getByText('この日の値を保存'));

    expect(onSave).toHaveBeenCalledWith('2026-08-28', 70.5, 18);
  });

  it('体脂肪率が 0 なら未入力として null で渡す', () => {
    const onSave = jest.fn();
    render(
      <BodyLogInput
        date="2026-08-28"
        log={null}
        latestLog={{ ...log, bodyFatPercentage: null }}
        onSave={onSave}
      />,
    );

    fireEvent.press(screen.getByText('この日の値を保存'));

    expect(onSave).toHaveBeenCalledWith('2026-08-28', 70.5, null);
  });

  it('記録が一つも無ければ 0 から始める', () => {
    render(<BodyLogInput date="2026-08-28" log={null} latestLog={null} onSave={jest.fn()} />);
    expect(screen.getAllByDisplayValue('0')).toHaveLength(2);
  });
});
