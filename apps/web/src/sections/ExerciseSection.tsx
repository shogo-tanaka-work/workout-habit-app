import { useState } from 'react';

import { LineChart, type LinePoint } from '../components/LineChart';
import { Loadable } from '../components/Loadable';
import { Section } from '../components/Section';
import { useApiData, type ApiDataState } from '../hooks/useApiData';
import type {
  ExerciseDetailResponse,
  ExerciseGoal,
  ExercisesResponse,
  GoalsResponse,
} from '../types/api';
import { formatDateKey, formatShortDate } from '../utils/datetime';
import { formatVolume, formatWeight, safeDivide } from '../utils/number';
import type { ToggleOption } from '../components/ToggleGroup';
import { ToggleGroup } from '../components/ToggleGroup';

// 種目別グラフ: /analytics/exercises で種目を選び、
// /analytics/exercises/:id のセッション推移を表示する。
// /goals に選択中種目の目標があれば、水平の目標線と達成率を重ねる。

type SeriesMode = 'topWeight' | 'oneRepMax' | 'volume';

const SERIES_OPTIONS: readonly ToggleOption<SeriesMode>[] = [
  { value: 'topWeight', label: 'トップ重量' },
  { value: 'oneRepMax', label: '推定1RM' },
  { value: 'volume', label: 'ボリューム' },
];

const DETAIL_MONTHS = 12;

const seriesValueOf = (
  session: ExerciseDetailResponse['sessions'][number],
  seriesMode: SeriesMode,
): number => {
  switch (seriesMode) {
    case 'topWeight':
      return session.topWeightKg;
    case 'oneRepMax':
      return session.bestOneRepMax;
    case 'volume':
      return session.totalVolume;
  }
};

type GoalSummaryProps = {
  goal: ExerciseGoal;
  sessions: ExerciseDetailResponse['sessions'];
};

/** 「目標 100kg / 現在トップ 90kg（90%）」の達成率表示。 */
const GoalSummary = ({ goal, sessions }: GoalSummaryProps) => {
  const bestTopWeightKg = Math.max(...sessions.map((session) => session.topWeightKg), 0);
  const achievedPercent = Math.round(safeDivide(bestTopWeightKg, goal.targetWeightKg) * 100);
  return (
    <p className="goal-summary">
      目標 {formatWeight(goal.targetWeightKg)} / 現在トップ {formatWeight(bestTopWeightKg)}（
      {achievedPercent}%）
    </p>
  );
};

type ExerciseSectionProps = {
  /** 種目一覧。PlanSection と共用するため App が一度だけ取得して配る。 */
  exercisesState: ApiDataState<ExercisesResponse>;
};

export const ExerciseSection = ({ exercisesState }: ExerciseSectionProps) => {
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [seriesMode, setSeriesMode] = useState<SeriesMode>('topWeight');
  const todayKey = formatDateKey(new Date());

  const options = (exercisesState.data?.exercises ?? []).filter(
    (exercise) => exercise.sessionCount > 0,
  );
  // 未選択時は実施回数最多の種目（API がソート済み）を初期表示にする。
  const effectiveExerciseId = selectedExerciseId || options[0]?.id || '';
  // 種目 ID は外部入力（API レスポンス）由来のため、パスへ埋め込む前にエンコードする。
  const detailState = useApiData<ExerciseDetailResponse>(
    effectiveExerciseId
      ? `/analytics/exercises/${encodeURIComponent(effectiveExerciseId)}?months=${DETAIL_MONTHS}&today=${todayKey}`
      : null,
  );
  // 目標は補助表示。取得に失敗しても目標線を出さないだけにし、グラフ本体は壊さない
  // （Loadable で包まず data だけを見る）。
  const goalsState = useApiData<GoalsResponse>('/goals');

  return (
    <Section
      title="種目別グラフ"
      subtitle={`直近${DETAIL_MONTHS}か月のセッション推移（推定1RMはEpley式）`}
      actions={
        <div className="toggle-group-row">
          <select
            className="exercise-select"
            value={effectiveExerciseId}
            onChange={(event) => setSelectedExerciseId(event.target.value)}
          >
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}（{option.sessionCount}回）
              </option>
            ))}
          </select>
          <ToggleGroup options={SERIES_OPTIONS} selected={seriesMode} onSelect={setSeriesMode} />
        </div>
      }
    >
      <Loadable state={exercisesState}>
        {() =>
          options.length === 0 ? (
            <p className="chart-empty">
              記録のある種目がありません。アプリでワークアウトを記録すると表示されます
            </p>
          ) : (
            <Loadable state={detailState}>
              {(detail) => {
                const points: LinePoint[] = detail.sessions.map((session) => ({
                  label: formatShortDate(session.date),
                  value: seriesValueOf(session, seriesMode),
                }));
                const formatValue = seriesMode === 'volume' ? formatVolume : formatWeight;
                // 目標は重量に対するもの。ボリューム表示では意味を持たないため出さない。
                const goal =
                  seriesMode === 'volume'
                    ? null
                    : (goalsState.data?.goals.find(
                        (candidate) => candidate.exerciseId === detail.exercise.id,
                      ) ?? null);
                return (
                  <>
                    {goal ? <GoalSummary goal={goal} sessions={detail.sessions} /> : null}
                    <LineChart
                      points={points}
                      formatValue={formatValue}
                      goalValue={goal ? goal.targetWeightKg : null}
                    />
                  </>
                );
              }}
            </Loadable>
          )
        }
      </Loadable>
    </Section>
  );
};
