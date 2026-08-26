import type { Exercise, WorkoutExercise } from '../types/domain';
import { REST_PRESET_LIMIT } from '../types/domain';

// 共通タイマー（種目をまたいで使い回す休憩時間）の編集規則。
//
// 設定タブと記録中の休憩ピッカーの両方から編集できる。規則を各画面が持つと、
// 「上限を4件にする」「削除後は先頭を選ぶ」といった変更で片方だけ挙動が変わり、
// 同じプリセット集合なのに画面ごとに違う動きをすることになる。

/** 種目ごとの休憩が決まっていないときに使う秒数。 */
export const FALLBACK_REST_SECONDS = 120;

export type PresetEdit = {
  presets: number[];
  /** 編集対象の位置。追加・削除のあとも選択が外れないよう、ここで決める。 */
  selectedIndex: number;
};

/**
 * 選択中の値を複製して足す。上限に達していれば何もしない。
 * 追加した要素をそのまま編集対象にする。
 */
export const addRestPreset = (presets: number[], selectedIndex: number): PresetEdit => {
  if (presets.length >= REST_PRESET_LIMIT) {
    return { presets, selectedIndex };
  }
  const seed = presets[selectedIndex] ?? FALLBACK_REST_SECONDS;
  return { presets: [...presets, seed], selectedIndex: presets.length };
};

/**
 * 選択中の値を消す。**最後の1件は残す**（空になると選ぶものが無くなる）。
 */
export const removeRestPreset = (presets: number[], selectedIndex: number): PresetEdit => {
  if (presets.length <= 1) {
    return { presets, selectedIndex };
  }
  return {
    presets: presets.filter((_, index) => index !== selectedIndex),
    selectedIndex: Math.max(0, selectedIndex - 1),
  };
};

/**
 * この種目に使う休憩秒数。記録ごとの上書き → 種目の既定 → 全体の既定 の順に見る。
 *
 * 画面（表示）とフック（実際に走らせるタイマー）で別々に書いていたため、
 * 既定値を変えると「表示は 2:00 なのにタイマーは別の値」という食い違いが起きる状態だった。
 *
 * `restSecondsOverride` に入るのは、その記録で休憩ピッカーから決めた値だけ。
 * 予定が持ち込む上書きは開始時に外れる（db/queries.ts の `startPlannedWorkout`）。
 */
export const restSecondsFor = (
  workoutExercise: Pick<WorkoutExercise, 'restSecondsOverride'>,
  exercise: Pick<Exercise, 'defaultRestSeconds'> | undefined,
): number =>
  workoutExercise.restSecondsOverride ?? exercise?.defaultRestSeconds ?? FALLBACK_REST_SECONDS;
