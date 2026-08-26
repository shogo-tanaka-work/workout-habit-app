import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { buildWorkoutSet } from '../../test-support/factories';
import { SetLogTable } from '../SetLogTable';

const sets = [
  buildWorkoutSet({ id: 's1', orderIndex: 1, weightKg: 60, reps: 10 }),
  buildWorkoutSet({ id: 's2', orderIndex: 2, weightKg: 62.5, reps: 8, isCompleted: true }),
];

describe('SetLogTable', () => {
  it('セットが無ければ作り方を案内する', () => {
    render(<SetLogTable sets={[]} onPatchSet={jest.fn()} onOpenSetActions={jest.fn()} />);
    expect(screen.getByText('「＋ セット」で1セット目を作ると、すぐ保存されます。')).toBeTruthy();
  });

  it('重量と回数を入力欄として出す', () => {
    render(<SetLogTable sets={sets} onPatchSet={jest.fn()} onOpenSetActions={jest.fn()} />);
    expect(screen.getByDisplayValue('60')).toBeTruthy();
    expect(screen.getByDisplayValue('62.5')).toBeTruthy();
    expect(screen.getByDisplayValue('8')).toBeTruthy();
  });

  it('重量を入力して確定すると保存する', () => {
    const onPatchSet = jest.fn();
    render(<SetLogTable sets={sets} onPatchSet={onPatchSet} onOpenSetActions={jest.fn()} />);

    const input = screen.getByDisplayValue('60');
    fireEvent.changeText(input, '65');
    fireEvent(input, 'submitEditing');

    expect(onPatchSet).toHaveBeenCalledWith('s1', { weightKg: 65 });
  });

  it('回数は整数へ丸め、負の値にしない', () => {
    const onPatchSet = jest.fn();
    render(<SetLogTable sets={sets} onPatchSet={onPatchSet} onOpenSetActions={jest.fn()} />);

    const input = screen.getByDisplayValue('10');
    fireEvent.changeText(input, '-8.6');
    fireEvent(input, 'submitEditing');

    expect(onPatchSet).toHaveBeenCalledWith('s1', { reps: 0 });
  });

  it('読めない値を入れたら元の値へ戻す', () => {
    const onPatchSet = jest.fn();
    render(<SetLogTable sets={sets} onPatchSet={onPatchSet} onOpenSetActions={jest.fn()} />);

    const input = screen.getByDisplayValue('60');
    fireEvent.changeText(input, 'あ');
    fireEvent(input, 'submitEditing');

    expect(onPatchSet).toHaveBeenCalledWith('s1', { weightKg: 60 });
  });

  it('完了の印を切り替える', () => {
    const onPatchSet = jest.fn();
    render(<SetLogTable sets={sets} onPatchSet={onPatchSet} onOpenSetActions={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('セット 1 を完了'));
    expect(onPatchSet).toHaveBeenCalledWith('s1', { isCompleted: true });

    fireEvent.press(screen.getByLabelText('セット 2 を完了'));
    expect(onPatchSet).toHaveBeenCalledWith('s2', { isCompleted: false });
  });

  it('ウォームアップの指定を表から切り替える', () => {
    const onPatchSet = jest.fn();
    render(<SetLogTable sets={sets} onPatchSet={onPatchSet} onOpenSetActions={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('セット 1 をウォームアップにする'));
    expect(onPatchSet).toHaveBeenCalledWith('s1', { isWarmup: true });
  });

  it('ウォームアップのセットは番号ではなく WU を出す', () => {
    render(
      <SetLogTable
        sets={[buildWorkoutSet({ id: 's1', isWarmup: true })]}
        onPatchSet={jest.fn()}
        onOpenSetActions={jest.fn()}
      />,
    );
    // 行ラベルの「WU」と紛れないよう、セット番号のセルの中だけを見る。
    expect(within(screen.getByLabelText('セット 1 の操作')).getByText('WU')).toBeTruthy();
  });

  it('セット番号のタップで操作シートを開く', () => {
    const onOpenSetActions = jest.fn();
    render(<SetLogTable sets={sets} onPatchSet={jest.fn()} onOpenSetActions={onOpenSetActions} />);

    fireEvent.press(screen.getByLabelText('セット 2 の操作'));

    expect(onOpenSetActions).toHaveBeenCalledWith(sets[1], 2);
  });
});
