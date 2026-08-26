import { fireEvent, render, screen } from '@testing-library/react-native';

import { buildBodyPart, buildExercise } from '../../test-support/factories';
import { ExercisePicker } from '../ExercisePicker';

const bench = buildExercise({ id: 'bench-press', name: 'ベンチプレス' });
const incline = buildExercise({ id: 'incline-press', name: 'インクラインダンベルプレス' });
const squat = buildExercise({ id: 'squat', name: 'スクワット', primaryBodyPartId: 'legs' });

const renderPicker = (overrides: Partial<React.ComponentProps<typeof ExercisePicker>> = {}) =>
  render(
    <ExercisePicker
      exercises={[bench, incline, squat]}
      menuExercises={[]}
      bodyParts={[buildBodyPart(), buildBodyPart({ id: 'legs', name: '脚', orderIndex: 2 })]}
      todaySetCountByExerciseId={new Map()}
      lastPerformedByExerciseId={new Map()}
      onSelect={jest.fn()}
      onAddCustomExercise={jest.fn()}
      onSaveTemplate={jest.fn()}
      canSaveTemplate={false}
      onPause={jest.fn()}
      onComplete={jest.fn()}
      {...overrides}
    />,
  );

describe('今日のメニュー', () => {
  it('記録に入っている種目が無ければ欄ごと出さない', () => {
    renderPicker();
    expect(screen.queryByText('今日のメニュー')).toBeNull();
  });

  it('予定から入った種目を種目数つきで先に並べる', () => {
    renderPicker({ menuExercises: [incline, bench] });
    expect(screen.getByText('今日のメニュー')).toBeTruthy();
    expect(screen.getByText('2 種目')).toBeTruthy();
  });

  it('まだ記録していない種目は「未記録」と出す', () => {
    renderPicker({ menuExercises: [incline] });
    expect(screen.getByText('未記録')).toBeTruthy();
  });

  it('記録済みの種目はセット数を出す', () => {
    renderPicker({
      menuExercises: [incline],
      todaySetCountByExerciseId: new Map([['incline-press', 3]]),
    });
    expect(screen.getByText('3 セット')).toBeTruthy();
  });

  it('メニューの行から種目を開ける', () => {
    const onSelect = jest.fn();
    // 下の一覧には出ない部位（脚）の種目を選び、押した行を一意にする。
    renderPicker({ menuExercises: [squat], onSelect });
    fireEvent.press(screen.getByText('スクワット'));
    expect(onSelect).toHaveBeenCalledWith(squat);
  });
});

describe('種目を選択', () => {
  it('既定では先頭の部位で絞り込む', () => {
    renderPicker();
    expect(screen.getByText('ベンチプレス')).toBeTruthy();
    expect(screen.queryByText('スクワット')).toBeNull();
  });

  it('部位タブを押すとその部位の種目に切り替わる', () => {
    renderPicker();
    fireEvent.press(screen.getByText('脚'));
    expect(screen.getByText('スクワット')).toBeTruthy();
    expect(screen.queryByText('ベンチプレス')).toBeNull();
  });

  it('今日やった種目にはセット数を添える', () => {
    renderPicker({ todaySetCountByExerciseId: new Map([['bench-press', 4]]) });
    expect(screen.getByText('今日 4 セット')).toBeTruthy();
  });

  it('前回からの日数を添える', () => {
    const today = new Date();
    const threeDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3);
    const isoDate = `${threeDaysAgo.getFullYear()}-${`${threeDaysAgo.getMonth() + 1}`.padStart(2, '0')}-${`${threeDaysAgo.getDate()}`.padStart(2, '0')}`;
    renderPicker({ lastPerformedByExerciseId: new Map([['bench-press', isoDate]]) });
    expect(screen.getByText('3 日前')).toBeTruthy();
  });

  it('一度もやっていない種目は未実施と出す', () => {
    renderPicker();
    expect(screen.getAllByText('未実施').length).toBeGreaterThan(0);
  });

  it('種目構成を保存できないときはテンプレート保存を出さない', () => {
    renderPicker();
    expect(screen.queryByText('今日の種目構成をテンプレートとして保存')).toBeNull();
  });

  it('ワークアウトを締める操作を出す', () => {
    const onComplete = jest.fn();
    const onPause = jest.fn();
    renderPicker({ onComplete, onPause });
    fireEvent.press(screen.getByText('今日のワークアウトを完了'));
    fireEvent.press(screen.getByText('一時保存して閉じる'));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onPause).toHaveBeenCalledTimes(1);
  });
});
