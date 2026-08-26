import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { buildBodyPart, buildExercise } from '../../test-support/factories';
import { ExerciseSelectList } from '../ExerciseSelectList';

const bench = buildExercise({ id: 'bench-press', name: 'ベンチプレス' });
const squat = buildExercise({ id: 'squat', name: 'スクワット', primaryBodyPartId: 'legs' });
const bodyParts = [buildBodyPart(), buildBodyPart({ id: 'legs', name: '脚', orderIndex: 2 })];

const renderList = (
  overrides: Partial<React.ComponentProps<typeof ExerciseSelectList>> = {},
) =>
  render(
    <ExerciseSelectList
      exercises={[bench, squat]}
      bodyParts={bodyParts}
      onSelect={jest.fn()}
      onAddCustomExercise={jest.fn()}
      {...overrides}
    />,
  );

describe('ExerciseSelectList', () => {
  it('既定は先頭の部位で絞り込む（「よく使う」を初期表示にしない）', () => {
    renderList();
    expect(screen.getByText('ベンチプレス')).toBeTruthy();
    expect(screen.queryByText('スクワット')).toBeNull();
  });

  it('「よく使う」を選ぶと絞り込みを外す', () => {
    renderList();

    fireEvent.press(screen.getByText('よく使う'));

    expect(screen.getByText('ベンチプレス')).toBeTruthy();
    expect(screen.getByText('スクワット')).toBeTruthy();
  });

  it('同じ部位をもう一度押すと絞り込みを解除する', () => {
    renderList();

    fireEvent.press(screen.getByText('胸'));

    expect(screen.getByText('スクワット')).toBeTruthy();
  });

  it('種目を選べる', () => {
    const onSelect = jest.fn();
    renderList({ onSelect });

    fireEvent.press(screen.getByText('ベンチプレス'));

    expect(onSelect).toHaveBeenCalledWith(bench);
  });

  it('添え書きは渡されたときだけ出す', () => {
    renderList({ describeExercise: () => '3 日前' });
    expect(screen.getByText('3 日前')).toBeTruthy();
  });

  it('その部位に種目が無ければ追加を促す', () => {
    renderList({ exercises: [] });
    expect(
      screen.getByText('この部位の種目がまだありません。下のボタンから追加できます。'),
    ).toBeTruthy();
  });

  it('部位を絞っているときだけ、その部位への追加ボタンを出す', () => {
    renderList();
    expect(screen.getByText('＋ 「胸」に種目を追加')).toBeTruthy();

    fireEvent.press(screen.getByText('よく使う'));
    expect(screen.queryByText(/種目を追加/)).toBeNull();
  });

  it('追加は名前を尋ねてから渡す', () => {
    const onAddCustomExercise = jest.fn();
    const promptSpy = jest
      .spyOn(Alert, 'prompt')
      .mockImplementation((_title, _message, buttons) => {
        if (Array.isArray(buttons)) {
          const add = buttons.find((button) => button.text === '追加');
          (add?.onPress as ((value?: string) => void) | undefined)?.('ケーブルフライ');
        }
      });
    renderList({ onAddCustomExercise });

    fireEvent.press(screen.getByText('＋ 「胸」に種目を追加'));

    expect(onAddCustomExercise).toHaveBeenCalledWith('ケーブルフライ', 'chest');
    promptSpy.mockRestore();
  });

  it('空の名前では追加しない', () => {
    const onAddCustomExercise = jest.fn();
    const promptSpy = jest
      .spyOn(Alert, 'prompt')
      .mockImplementation((_title, _message, buttons) => {
        if (Array.isArray(buttons)) {
          const add = buttons.find((button) => button.text === '追加');
          (add?.onPress as ((value?: string) => void) | undefined)?.('   ');
        }
      });
    renderList({ onAddCustomExercise });

    fireEvent.press(screen.getByText('＋ 「胸」に種目を追加'));

    expect(onAddCustomExercise).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });
});
