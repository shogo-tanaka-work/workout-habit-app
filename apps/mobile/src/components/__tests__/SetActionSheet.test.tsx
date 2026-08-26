import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { buildWorkoutSet } from '../../test-support/factories';
import type { SetPatch } from '../../types/domain';
import { SetActionSheet } from '../SetActionSheet';

const set = buildWorkoutSet({ id: 's2', weightKg: 60, reps: 10 });

const renderSheet = (overrides: Partial<React.ComponentProps<typeof SetActionSheet>> = {}) =>
  render(
    <SetActionSheet
      set={set}
      setNumber={2}
      previousSet={null}
      previousSessionSet={null}
      onPatchSet={jest.fn()}
      onClose={jest.fn()}
      {...overrides}
    />,
  );

describe('コピー', () => {
  it('前のセットが無ければコピーを出さない', () => {
    renderSheet();
    expect(screen.queryByText('前のセットをコピー')).toBeNull();
    expect(screen.queryByText('前回の記録をコピー')).toBeNull();
  });

  it('前のセットの重量とレップを写して閉じる', () => {
    const onPatchSet = jest.fn();
    const onClose = jest.fn();
    renderSheet({
      previousSet: buildWorkoutSet({ id: 's1', weightKg: 57.5, reps: 12 }),
      onPatchSet,
      onClose,
    });

    fireEvent.press(screen.getByText('前のセットをコピー'));

    expect(onPatchSet).toHaveBeenCalledWith('s2', { weightKg: 57.5, reps: 12 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('前回の同じ番号のセットを写せる', () => {
    const onPatchSet = jest.fn();
    renderSheet({
      previousSessionSet: buildWorkoutSet({ id: 'old', weightKg: 55, reps: 10 }),
      onPatchSet,
    });

    fireEvent.press(screen.getByText('前回の記録をコピー'));

    expect(onPatchSet).toHaveBeenCalledWith('s2', { weightKg: 55, reps: 10 });
  });
});

describe('削除', () => {
  it('記録中は確認を挟まず即削除する', () => {
    const onPatchSet = jest.fn<void, [string, SetPatch]>();
    const onClose = jest.fn();
    renderSheet({ onPatchSet, onClose });

    fireEvent.press(screen.getByText('削除'));

    // 削除は論理削除（deletedAt に時刻を入れる）。行は残す。
    const [setId, patch] = onPatchSet.mock.calls[0];
    expect(setId).toBe('s2');
    expect(typeof patch.deletedAt).toBe('string');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('過去の記録を直すときは一拍置く', () => {
    const onPatchSet = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    renderSheet({ confirmDelete: true, onPatchSet });

    fireEvent.press(screen.getByText('削除'));

    expect(alertSpy).toHaveBeenCalledWith(
      'セット 2 を削除',
      '60kg × 10 回 の記録を削除します。',
      expect.any(Array),
    );
    expect(onPatchSet).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe('閉じる', () => {
  it('閉じるで何も変えずに戻る', () => {
    const onPatchSet = jest.fn();
    const onClose = jest.fn();
    renderSheet({ onPatchSet, onClose });

    fireEvent.press(screen.getByText('閉じる'));

    expect(onPatchSet).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
