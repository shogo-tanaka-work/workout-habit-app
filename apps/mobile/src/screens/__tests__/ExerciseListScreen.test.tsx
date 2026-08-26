import { fireEvent, render, screen } from '@testing-library/react-native';

import { buildBodyPart, buildExercise } from '../../test-support/factories';
import { ExerciseListScreen } from '../ExerciseListScreen';

const bodyParts = [buildBodyPart(), buildBodyPart({ id: 'legs', name: '脚', orderIndex: 2 })];
const bodyPartById = new Map(bodyParts.map((part) => [part.id, part]));
const exercises = [
  buildExercise({ id: 'bench-press', name: 'ベンチプレス' }),
  buildExercise({ id: 'incline-press', name: 'インクラインダンベルプレス' }),
  buildExercise({ id: 'squat', name: 'スクワット', primaryBodyPartId: 'legs' }),
  buildExercise({ id: 'old', name: '使わない種目', isArchived: true }),
];

const renderScreen = (
  overrides: Partial<React.ComponentProps<typeof ExerciseListScreen>> = {},
) =>
  render(
    <ExerciseListScreen
      exercises={exercises}
      bodyParts={bodyParts}
      bodyPartById={bodyPartById}
      newExerciseName=""
      onChangeNewExerciseName={jest.fn()}
      onAddCustomExercise={jest.fn()}
      onEditExercise={jest.fn()}
      onSelectExercise={jest.fn()}
      {...overrides}
    />,
  );

describe('一覧', () => {
  it('アーカイブ済みを除いた件数を出す', () => {
    renderScreen();
    expect(screen.getByText('3 件')).toBeTruthy();
  });

  it('種目名で絞り込む', () => {
    renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText('種目名で絞り込む'), 'インクライン');

    expect(screen.getByText('インクラインダンベルプレス')).toBeTruthy();
    expect(screen.queryByText('ベンチプレス')).toBeNull();
  });

  it('大文字小文字と前後の空白を無視して絞り込む', () => {
    renderScreen({
      exercises: [buildExercise({ id: 'custom-1', name: 'Cable Fly' })],
    });

    fireEvent.changeText(screen.getByPlaceholderText('種目名で絞り込む'), '  cable ');

    expect(screen.getByText('Cable Fly')).toBeTruthy();
  });

  it('部位で絞り込み、もう一度押すと解除する', () => {
    renderScreen();

    fireEvent.press(screen.getByText('脚'));
    expect(screen.getByText('スクワット')).toBeTruthy();
    expect(screen.queryByText('ベンチプレス')).toBeNull();

    fireEvent.press(screen.getByText('脚'));
    expect(screen.getByText('ベンチプレス')).toBeTruthy();
  });

  it('条件に合う種目が無ければそう伝える', () => {
    renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText('種目名で絞り込む'), 'デッドリフト');

    expect(screen.getByText('条件に合う種目がありません。')).toBeTruthy();
  });

  it('部位・休憩・バー重量を添える', () => {
    renderScreen();
    expect(screen.getAllByText(/休憩 2:00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/胸/).length).toBeGreaterThan(0);
  });

  it('行タップで種目詳細を開く', () => {
    const onSelectExercise = jest.fn();
    renderScreen({ onSelectExercise });

    fireEvent.press(screen.getByText('ベンチプレス'));

    expect(onSelectExercise).toHaveBeenCalledWith('bench-press');
  });

  it('編集ボタンで設定を開く', () => {
    const onEditExercise = jest.fn();
    renderScreen({ onEditExercise });

    fireEvent.press(screen.getAllByText('編集')[0]);

    expect(onEditExercise).toHaveBeenCalledWith('bench-press');
  });
});

describe('アーカイブ済み', () => {
  it('別枠にまとめ、そこから戻せる', () => {
    const onEditExercise = jest.fn();
    renderScreen({ onEditExercise });

    expect(screen.getByText('アーカイブ済み')).toBeTruthy();
    fireEvent.press(screen.getByText('使わない種目'));

    expect(onEditExercise).toHaveBeenCalledWith('old');
  });

  it('アーカイブが無ければ欄ごと出さない', () => {
    renderScreen({ exercises: exercises.filter((exercise) => !exercise.isArchived) });
    expect(screen.queryByText('アーカイブ済み')).toBeNull();
  });
});

describe('種目の追加', () => {
  it('ふだんは畳んでおく', () => {
    renderScreen();
    expect(screen.queryByPlaceholderText('例: インクラインダンベルプレス')).toBeNull();
  });

  it('開いて部位を選んで登録する', () => {
    const onAddCustomExercise = jest.fn();
    renderScreen({ onAddCustomExercise });

    fireEvent.press(screen.getByText('＋ 種目を追加'));
    // 「脚」は部位の絞り込みタブにもある。追加フォームは一覧の下にあるので末尾を選ぶ。
    const legChips = screen.getAllByText('脚');
    fireEvent.press(legChips[legChips.length - 1]);
    fireEvent.press(screen.getByText('登録'));

    expect(onAddCustomExercise).toHaveBeenCalledWith('legs');
  });

  it('登録したらフォームを畳む', () => {
    renderScreen();

    fireEvent.press(screen.getByText('＋ 種目を追加'));
    fireEvent.press(screen.getByText('登録'));

    expect(screen.getByText('＋ 種目を追加')).toBeTruthy();
  });

  it('キャンセルでは登録しない', () => {
    const onAddCustomExercise = jest.fn();
    renderScreen({ onAddCustomExercise });

    fireEvent.press(screen.getByText('＋ 種目を追加'));
    fireEvent.press(screen.getByText('キャンセル'));

    expect(onAddCustomExercise).not.toHaveBeenCalled();
  });

  it('入力した名前を親へ渡す', () => {
    const onChangeNewExerciseName = jest.fn();
    renderScreen({ onChangeNewExerciseName });

    fireEvent.press(screen.getByText('＋ 種目を追加'));
    fireEvent.changeText(
      screen.getByPlaceholderText('例: インクラインダンベルプレス'),
      'ケーブルフライ',
    );

    expect(onChangeNewExerciseName).toHaveBeenCalledWith('ケーブルフライ');
  });
});
