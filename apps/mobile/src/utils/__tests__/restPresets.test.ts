import { buildExercise, buildWorkoutExercise } from '../../test-support/factories';
import { REST_PRESET_LIMIT } from '../../types/domain';
import {
  addRestPreset,
  FALLBACK_REST_SECONDS,
  removeRestPreset,
  restSecondsFor,
} from '../restPresets';

describe('restSecondsFor', () => {
  it('記録ごとの上書きを最優先で使う', () => {
    const seconds = restSecondsFor(
      buildWorkoutExercise({ restSecondsOverride: 90 }),
      buildExercise({ defaultRestSeconds: 120 }),
    );
    expect(seconds).toBe(90);
  });

  it('上書きが無ければ種目の既定を使う', () => {
    const seconds = restSecondsFor(
      buildWorkoutExercise({ restSecondsOverride: null }),
      buildExercise({ defaultRestSeconds: 150 }),
    );
    expect(seconds).toBe(150);
  });

  it('種目が引けなければ全体の既定へ落ちる', () => {
    expect(restSecondsFor(buildWorkoutExercise(), undefined)).toBe(FALLBACK_REST_SECONDS);
  });

  it('上書きが 0 のときは 0 を尊重する（未設定と混同しない）', () => {
    const seconds = restSecondsFor(
      buildWorkoutExercise({ restSecondsOverride: 0 }),
      buildExercise({ defaultRestSeconds: 120 }),
    );
    expect(seconds).toBe(0);
  });
});

describe('addRestPreset', () => {
  it('選択中の値を複製して足し、追加したものを選択する', () => {
    expect(addRestPreset([120, 180], 1)).toEqual({ presets: [120, 180, 180], selectedIndex: 2 });
  });

  it('上限に達していたら何もしない', () => {
    const full = Array.from({ length: REST_PRESET_LIMIT }, (_, index) => 60 * (index + 1));
    expect(addRestPreset(full, 0)).toEqual({ presets: full, selectedIndex: 0 });
  });

  it('選択位置が空なら既定値を種にする', () => {
    expect(addRestPreset([], 0)).toEqual({
      presets: [FALLBACK_REST_SECONDS],
      selectedIndex: 0,
    });
  });
});

describe('removeRestPreset', () => {
  it('選択中の値を消して1つ前を選ぶ', () => {
    expect(removeRestPreset([120, 180, 240], 2)).toEqual({
      presets: [120, 180],
      selectedIndex: 1,
    });
  });

  it('先頭を消しても選択位置は負にならない', () => {
    expect(removeRestPreset([120, 180], 0)).toEqual({ presets: [180], selectedIndex: 0 });
  });

  it('最後の1件は残す', () => {
    expect(removeRestPreset([120], 0)).toEqual({ presets: [120], selectedIndex: 0 });
  });
});
