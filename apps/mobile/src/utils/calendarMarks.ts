import { bodyPartColor } from '../styles/theme';
import type { Exercise, Workout, WorkoutExercise } from '../types/domain';

// 月間カレンダーの日セルに出すマーク。「どの部位を何種目やったか」を色と数で表す。
// 色だけに情報を持たせない（.agents/DESIGN.md「カテゴリ色（部位）」）。

type DayMark = {
  bodyPartId: string;
  color: string;
  /** その日にその部位で行った種目数。 */
  count: number;
};

export type DayMarks = {
  marks: DayMark[];
  /** 実績がまだなく、予定だけの日。カレンダーでは輪郭マークで区別する。 */
  isPlannedOnly: boolean;
};

// 日付ごとのマークを組み立てる。マークの並びは種目の入力順（orderIndex）に従う。
export const buildDayMarks = (
  workouts: Workout[],
  workoutExercises: WorkoutExercise[],
  exerciseById: Map<string, Exercise>,
): Map<string, DayMarks> => {
  const workoutsById = new Map(workouts.map((workout) => [workout.id, workout]));
  const byDate = new Map<string, DayMarks>();
  const countsByDate = new Map<string, Map<string, DayMark>>();

  const ordered = [...workoutExercises].sort((a, b) => a.orderIndex - b.orderIndex);
  for (const item of ordered) {
    const workout = workoutsById.get(item.workoutId);
    if (!workout) {
      continue;
    }
    const date = workout.performedAt;
    const entry = byDate.get(date) ?? { marks: [], isPlannedOnly: true };
    if (workout.status !== 'planned') {
      entry.isPlannedOnly = false;
    }

    const counts = countsByDate.get(date) ?? new Map<string, DayMark>();
    const bodyPartId = exerciseById.get(item.exerciseId)?.primaryBodyPartId ?? 'unknown';
    const mark = counts.get(bodyPartId);
    if (mark) {
      mark.count += 1;
    } else {
      const created: DayMark = { bodyPartId, color: bodyPartColor(bodyPartId), count: 1 };
      counts.set(bodyPartId, created);
      entry.marks.push(created);
    }

    countsByDate.set(date, counts);
    byDate.set(date, entry);
  }

  return byDate;
};
