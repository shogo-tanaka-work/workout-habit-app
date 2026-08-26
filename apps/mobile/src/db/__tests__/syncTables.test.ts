import { isCustomExerciseId, newCustomExerciseId, SYNC_COLUMNS } from '../syncTables';

// 発番と判定が同じ接頭辞を使っていないと、全カスタム種目がプリセット扱いになり
// 名前・部位の変更が保存されなくなる（型でも lint でも検出できない）。
describe('カスタム種目の ID', () => {
  it('発番した ID は自分で判定できる', () => {
    expect(isCustomExerciseId(newCustomExerciseId())).toBe(true);
  });

  it('毎回違う ID になる', () => {
    expect(newCustomExerciseId()).not.toBe(newCustomExerciseId());
  });

  it('プリセット種目はカスタム扱いしない', () => {
    expect(isCustomExerciseId('bench-press')).toBe(false);
    expect(isCustomExerciseId('incline-dumbbell-press')).toBe(false);
  });
});

describe('SYNC_COLUMNS', () => {
  it('同期対象テーブルは必ず id を含む（outbox が行を引けるように）', () => {
    for (const columns of Object.values(SYNC_COLUMNS)) {
      expect(columns).toContain('id');
    }
  });

  it('workout_exercises は休憩の上書き列を運ぶ', () => {
    expect(SYNC_COLUMNS.workout_exercises).toContain('rest_seconds_override');
  });
});
