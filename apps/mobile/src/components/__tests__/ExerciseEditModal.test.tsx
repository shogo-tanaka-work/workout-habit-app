import { fireEvent, render, screen } from '@testing-library/react-native';

import { newCustomExerciseId } from '../../db/syncTables';
import { buildBodyPart, buildExercise } from '../../test-support/factories';
import { ExerciseEditModal } from '../ExerciseEditModal';

const bodyParts = [buildBodyPart(), buildBodyPart({ id: 'legs', name: '脚', orderIndex: 2 })];

const renderModal = (overrides: Partial<React.ComponentProps<typeof ExerciseEditModal>> = {}) =>
  render(
    <ExerciseEditModal
      exercise={buildExercise()}
      bodyParts={bodyParts}
      onSave={jest.fn()}
      onCancel={jest.fn()}
      {...overrides}
    />,
  );

describe('プリセット種目', () => {
  it('名前と部位を変えられないと伝える', () => {
    renderModal();
    expect(screen.getByText(/共有プリセットです/)).toBeTruthy();
  });

  it('名前の入力を無効にする', () => {
    renderModal();
    expect(screen.getByDisplayValue('ベンチプレス').props.editable).toBe(false);
  });

  it('休憩とバー重量は保存できる', () => {
    const onSave = jest.fn();
    renderModal({ onSave });

    fireEvent.press(screen.getByText('1:30'));
    fireEvent.press(screen.getByText('保存'));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ defaultRestSeconds: 90 }));
  });

  it('アーカイブを切り替えられる', () => {
    const onSave = jest.fn();
    renderModal({ onSave });

    fireEvent.press(screen.getByText('アーカイブする'));
    fireEvent.press(screen.getByText('保存'));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ isArchived: true }));
  });
});

describe('カスタム種目', () => {
  const custom = buildExercise({
    id: newCustomExerciseId(),
    name: 'ケーブルフライ',
    isArchived: false,
  });

  it('自分で追加した種目だと伝える', () => {
    renderModal({ exercise: custom });
    expect(screen.getByText('この種目はあなたが追加したものです。')).toBeTruthy();
  });

  it('名前と部位を変えて保存できる', () => {
    const onSave = jest.fn();
    renderModal({ exercise: custom, onSave });

    fireEvent.changeText(screen.getByDisplayValue('ケーブルフライ'), '  ケーブルクロスオーバー ');
    fireEvent.press(screen.getByText('脚'));
    fireEvent.press(screen.getByText('保存'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ケーブルクロスオーバー',
        primaryBodyPartId: 'legs',
      }),
    );
  });

  it('名前が空のときは保存させない', () => {
    const onSave = jest.fn();
    renderModal({ exercise: custom, onSave });

    fireEvent.changeText(screen.getByDisplayValue('ケーブルフライ'), '   ');
    fireEvent.press(screen.getByText('保存'));

    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('キャンセル', () => {
  it('変更を渡さずに閉じる', () => {
    const onSave = jest.fn();
    const onCancel = jest.fn();
    renderModal({ onSave, onCancel });

    fireEvent.press(screen.getByText('キャンセル'));

    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
