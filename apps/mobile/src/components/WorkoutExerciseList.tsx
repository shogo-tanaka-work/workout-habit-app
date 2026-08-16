import { memo } from 'react';

import { ExerciseLogSection } from './ExerciseLogSection';
import type { Exercise, SetPatch, WorkoutExercise, WorkoutSet } from '../types/domain';

// 記録の編集画面（WorkoutEditScreen）の種目リスト。
//
// カード1枚ぶんの中身は記録タブと同じ ExerciseLogSection を使う。
// 入り口が違うだけで、やることは「セットを入れる」で同じため。
//
// 記録中（active）のワークアウトなら休憩タイマーも出す。過去日の記録には出さない
// （これから休む場面が無く、代わりに削除の確認を挟む）。
export const WorkoutExerciseList = memo(function WorkoutExerciseList({
  workoutExercises,
  visibleSets,
  exerciseById,
  isRecording,
  onAddSet,
  onPatchSet,
  onStartRestTimer,
  onOpenRestPicker,
}: {
  workoutExercises: WorkoutExercise[];
  visibleSets: WorkoutSet[];
  exerciseById: Map<string, Exercise>;
  /** 記録中のワークアウトを開いているか。休憩タイマーの出し分けに使う。 */
  isRecording: boolean;
  onAddSet: (workoutExercise: WorkoutExercise) => void;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onStartRestTimer: (set: WorkoutSet, workoutExercise: WorkoutExercise) => void;
  onOpenRestPicker: (exerciseId: string, seconds: number) => void;
}) {
  return (
    <>
      {workoutExercises.map((workoutExercise) => (
        <ExerciseLogSection
          key={workoutExercise.id}
          workoutExercise={workoutExercise}
          exercise={exerciseById.get(workoutExercise.exerciseId)}
          visibleSets={visibleSets}
          confirmSetDelete={!isRecording}
          onAddSet={onAddSet}
          onPatchSet={onPatchSet}
          onStartRestTimer={isRecording ? onStartRestTimer : undefined}
          onOpenRestPicker={isRecording ? onOpenRestPicker : undefined}
        />
      ))}
    </>
  );
});
