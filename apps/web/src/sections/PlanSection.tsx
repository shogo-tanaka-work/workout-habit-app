import { Loadable } from '../components/Loadable';
import { Section } from '../components/Section';
import { useApiData, type ApiDataState } from '../hooks/useApiData';
import type { ExercisesResponse, PlansResponse } from '../types/api';
import { addDays, formatDateKey, formatShortDate } from '../utils/datetime';

// これからの予定。Claude Code が書いた計画（status='planned'）を一覧する。
//
// /plans は行そのままの形を返すため、ここで種目名の解決と並べ替えを行う。
// 集計はしない（合計や達成率のような数字は API 側の役割）。

/** 何日先まで見るか。モバイルの取り込み範囲（28日先）と揃える。 */
const DAYS_AHEAD = 28;

type PlanSectionProps = {
  /** 種目名の解決用。ExerciseSection と共用するため App が一度だけ取得して配る。 */
  exercisesState: ApiDataState<ExercisesResponse>;
};

export const PlanSection = ({ exercisesState }: PlanSectionProps) => {
  const now = new Date();
  const today = formatDateKey(now);
  const plansState = useApiData<PlansResponse>(
    `/plans?from=${today}&to=${formatDateKey(addDays(now, DAYS_AHEAD))}`,
  );

  return (
    <Section title="これからの予定" subtitle={`今日から${DAYS_AHEAD}日先までの計画`}>
      <Loadable state={plansState}>
        {(plans) => {
          const workouts = [...plans.tables.workouts].sort((a, b) =>
            a.performed_at.localeCompare(b.performed_at),
          );
          if (workouts.length === 0) {
            return (
              <p className="status-text">
                予定はありません。Claude Code から計画を書き込むとここに並びます。
              </p>
            );
          }

          const nameByExerciseId = new Map(
            (exercisesState.data?.exercises ?? []).map((exercise) => [exercise.id, exercise.name]),
          );

          return (
            <ul className="plan-list">
              {workouts.map((workout) => {
                const items = plans.tables.workout_exercises
                  .filter((item) => item.workout_id === workout.id)
                  .sort((a, b) => a.order_index - b.order_index);
                return (
                  <li key={workout.id} className="plan-item">
                    <div className="plan-item-header">
                      <span className="plan-item-date">
                        {formatShortDate(workout.performed_at)}
                      </span>
                      {workout.memo ? (
                        <span className="plan-item-memo">{workout.memo}</span>
                      ) : null}
                    </div>
                    <ul className="plan-exercise-list">
                      {items.map((item) => {
                        const sets = plans.tables.workout_sets
                          .filter((set) => set.workout_exercise_id === item.id)
                          .sort((a, b) => a.order_index - b.order_index);
                        return (
                          <li key={item.id} className="plan-exercise">
                            <span>
                              {nameByExerciseId.get(item.exercise_id) ?? item.exercise_id}
                            </span>
                            <span className="plan-exercise-sets">
                              {sets
                                .map((set) => `${set.weight_kg}kg × ${set.reps}`)
                                .join(' / ')}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          );
        }}
      </Loadable>
    </Section>
  );
};
