import { fireEvent, render, screen } from '@testing-library/react-native';

import { RestPickerModal } from '../RestPickerModal';

const renderModal = (overrides: Partial<React.ComponentProps<typeof RestPickerModal>> = {}) =>
  render(
    <RestPickerModal
      value={120}
      presets={[120, 180]}
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
      {...overrides}
    />,
  );

describe('RestPickerModal', () => {
  it('決定で、いま出ている秒数とプリセットを返す', () => {
    const onConfirm = jest.fn();
    renderModal({ onConfirm });

    fireEvent.press(screen.getByText('決定'));

    expect(onConfirm).toHaveBeenCalledWith(120, [120, 180]);
  });

  it('キャンセルでは何も返さない', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    renderModal({ onConfirm, onCancel });

    fireEvent.press(screen.getByText('キャンセル'));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('共通タイマーのタブでは選んだプリセットの秒数を適用する', () => {
    const onConfirm = jest.fn();
    renderModal({ onConfirm });

    fireEvent.press(screen.getByText('共通タイマー'));
    fireEvent.press(screen.getByText('3:00'));
    fireEvent.press(screen.getByText('決定'));

    expect(onConfirm).toHaveBeenCalledWith(180, [120, 180]);
  });

  it('共通タイマーを足すと選択中の値を複製する', () => {
    const onConfirm = jest.fn();
    renderModal({ onConfirm, presets: [120] });

    fireEvent.press(screen.getByText('共通タイマー'));
    fireEvent.press(screen.getByText('＋'));
    fireEvent.press(screen.getByText('決定'));

    expect(onConfirm).toHaveBeenCalledWith(120, [120, 120]);
  });

  it('共通タイマーを消せる（最後の1件は残る）', () => {
    const onConfirm = jest.fn();
    renderModal({ onConfirm, presets: [120, 180] });

    fireEvent.press(screen.getByText('共通タイマー'));
    // 選択中（2:00）を消すと 3:00 だけが残り、もう一度押しても消えない。
    fireEvent.press(screen.getByText('−'));
    fireEvent.press(screen.getByText('−'));
    fireEvent.press(screen.getByText('決定'));

    expect(onConfirm).toHaveBeenCalledWith(180, [180]);
  });

  it('プリセットが空でも、その種目の値から1件を用意する', () => {
    const onConfirm = jest.fn();
    renderModal({ onConfirm, value: 90, presets: [] });

    fireEvent.press(screen.getByText('決定'));

    expect(onConfirm).toHaveBeenCalledWith(90, [90]);
  });
});
