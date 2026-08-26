import { fireEvent, render, screen } from '@testing-library/react-native';

import { formatDate } from '../../utils/datetime';
import { DatePickerModal } from '../DatePickerModal';

const renderModal = (overrides: Partial<React.ComponentProps<typeof DatePickerModal>> = {}) =>
  render(
    <DatePickerModal
      value="2026-08-27"
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
      {...overrides}
    />,
  );

describe('DatePickerModal', () => {
  it('渡された日の月を開く', () => {
    renderModal();
    expect(screen.getByText('2026年8月')).toBeTruthy();
  });

  it('月と年を送れる', () => {
    renderModal();

    fireEvent.press(screen.getByLabelText('前の月'));
    expect(screen.getByText('2026年7月')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('前の年'));
    expect(screen.getByText('2025年7月')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('次の年'));
    fireEvent.press(screen.getByLabelText('次の月'));
    expect(screen.getByText('2026年8月')).toBeTruthy();
  });

  it('選んだ日を決定で返す', () => {
    const onConfirm = jest.fn();
    renderModal({ onConfirm });

    fireEvent.press(screen.getByText('15'));
    fireEvent.press(screen.getByText('決定'));

    expect(onConfirm).toHaveBeenCalledWith('2026-08-15');
  });

  it('選ばずに決定すると元の日のまま返す', () => {
    const onConfirm = jest.fn();
    renderModal({ onConfirm });

    fireEvent.press(screen.getByText('決定'));

    expect(onConfirm).toHaveBeenCalledWith('2026-08-27');
  });

  it('「今日」で今日の月へ飛ぶ', () => {
    const onConfirm = jest.fn();
    renderModal({ onConfirm, value: '2020-01-05' });

    fireEvent.press(screen.getByText('今日'));
    fireEvent.press(screen.getByText('決定'));

    expect(onConfirm).toHaveBeenCalledWith(formatDate(new Date()));
  });

  it('キャンセルでは日付を返さない', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    renderModal({ onConfirm, onCancel });

    fireEvent.press(screen.getByText('キャンセル'));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
