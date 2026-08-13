import type * as SQLite from 'expo-sqlite';

import type {
  BodyLog,
  BodyPart,
  Exercise,
  SyncSettings,
  Template,
  TemplateExercise,
  TimerSettings,
  UserExerciseSetting,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../types/domain';
import type {
  AppSettingRow,
  BodyLogRow,
  BodyPartRow,
  ExerciseRow,
  TemplateExerciseRow,
  TemplateRow,
  UserExerciseSettingRow,
  WorkoutRow,
  WorkoutExerciseRow,
  WorkoutSetRow,
} from '../types/db';
import { toSyncSettings, toTimerSettings } from './appSettings';
import {
  toBodyLog,
  toBodyPart,
  toExercise,
  toTemplate,
  toTemplateExercise,
  toUserExerciseSetting,
  toWorkout,
  toWorkoutExercise,
  toWorkoutSet,
} from './mappers';

// 端末 DB の読み取り。**書き込みは db/queries.ts が持つ。**
//
// 画面が要るデータを一度に読み、ドメイン型へ変換して配る。
// 取得カラムは types/db.ts の行型と1対1で対応させて明示する
// （SELECT * を使うと、テーブルへ列を足したときに行型と静かにずれる）。

type WorkoutData = {
  bodyParts: BodyPart[];
  /** 上書きを反映した実効値。生の行が要る場面は無いため、こちらだけを配る。 */
  exercises: Exercise[];
  userExerciseSettings: UserExerciseSetting[];
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  workoutSets: WorkoutSet[];
  templates: Template[];
  templateExercises: TemplateExercise[];
  timerSettings: TimerSettings;
  bodyLogs: BodyLog[];
  syncSettings: SyncSettings;
};

// 取得カラム。types/db.ts の行型と1対1で対応させる。
// SELECT * を使うと、テーブルへ列を足したときに行型と静かにずれる。

// 取得カラム。types/db.ts の行型と1対1で対応させる。
// SELECT * を使うと、テーブルへ列を足したときに行型と静かにずれる。
const BODY_PART_COLUMNS = 'id, name, order_index';

const EXERCISE_COLUMNS =
  'id, name, primary_body_part_id, default_rest_seconds, default_bar_weight_kg, category, is_archived';

const USER_EXERCISE_SETTING_COLUMNS = 'id, exercise_id, rest_seconds, bar_weight_kg, is_archived';

const WORKOUT_COLUMNS = 'id, performed_at, status, memo, last_saved_at, created_at';

const WORKOUT_EXERCISE_COLUMNS =
  'id, workout_id, exercise_id, order_index, rest_seconds_override, memo';

const WORKOUT_SET_COLUMNS =
  'id, workout_exercise_id, order_index, weight_kg, reps, rpe, is_warmup, is_completed, memo, rest_seconds, deleted_at';

const TEMPLATE_COLUMNS = 'id, name, created_at';

const TEMPLATE_EXERCISE_COLUMNS = 'id, template_id, exercise_id, order_index';

export const loadWorkoutData = async (database: SQLite.SQLiteDatabase): Promise<WorkoutData> => {
  const [
    bodyPartRows,
    exerciseRows,
    settingRows,
    workoutRows,
    workoutExerciseRows,
    workoutSetRows,
    templateRows,
    templateExerciseRows,
    appSettingRows,
    bodyLogRows,
  ] = await Promise.all([
    database.getAllAsync<BodyPartRow>(
      `SELECT ${BODY_PART_COLUMNS} FROM body_parts ORDER BY order_index`,
    ),
    database.getAllAsync<ExerciseRow>(
      // アーカイブ済みも読み込む。除外すると戻す手段が無くなるうえ、
      // 過去の記録から種目名を引けなくなる。表示側で絞る。
      `SELECT ${EXERCISE_COLUMNS} FROM exercises ORDER BY name`,
    ),
    database.getAllAsync<UserExerciseSettingRow>(
      `SELECT ${USER_EXERCISE_SETTING_COLUMNS} FROM user_exercise_settings`,
    ),
    database.getAllAsync<WorkoutRow>(
      `SELECT ${WORKOUT_COLUMNS} FROM workouts ORDER BY created_at DESC`,
    ),
    database.getAllAsync<WorkoutExerciseRow>(
      `SELECT ${WORKOUT_EXERCISE_COLUMNS} FROM workout_exercises ORDER BY order_index`,
    ),
    database.getAllAsync<WorkoutSetRow>(
      `SELECT ${WORKOUT_SET_COLUMNS} FROM workout_sets ORDER BY order_index`,
    ),
    database.getAllAsync<TemplateRow>(
      `SELECT ${TEMPLATE_COLUMNS} FROM templates ORDER BY created_at DESC`,
    ),
    database.getAllAsync<TemplateExerciseRow>(
      `SELECT ${TEMPLATE_EXERCISE_COLUMNS} FROM template_exercises ORDER BY order_index`,
    ),
    database.getAllAsync<AppSettingRow>('SELECT key, value FROM app_settings'),
    database.getAllAsync<BodyLogRow>(
      'SELECT id, measured_at, body_weight_kg, body_fat_percentage, memo FROM body_logs ORDER BY measured_at DESC',
    ),
  ]);
  const settings = settingRows.map(toUserExerciseSetting);
  const settingByExerciseId = new Map(settings.map((setting) => [setting.exerciseId, setting]));

  return {
    bodyParts: bodyPartRows.map(toBodyPart),
    // 上書きをここで畳み込む。画面ごとに合成すると、必ずどこかで忘れる。
    exercises: exerciseRows.map((row) => {
      const exercise = toExercise(row);
      const setting = settingByExerciseId.get(exercise.id);
      if (!setting) {
        return exercise;
      }
      return {
        ...exercise,
        defaultRestSeconds: setting.restSeconds ?? exercise.defaultRestSeconds,
        defaultBarWeightKg: setting.barWeightKg ?? exercise.defaultBarWeightKg,
        isArchived: setting.isArchived ?? exercise.isArchived,
      };
    }),
    userExerciseSettings: settings,
    workouts: workoutRows.map(toWorkout),
    workoutExercises: workoutExerciseRows.map(toWorkoutExercise),
    workoutSets: workoutSetRows.map(toWorkoutSet),
    templates: templateRows.map(toTemplate),
    templateExercises: templateExerciseRows.map(toTemplateExercise),
    timerSettings: toTimerSettings(appSettingRows),
    bodyLogs: bodyLogRows.map(toBodyLog),
    syncSettings: toSyncSettings(appSettingRows),
  };
};

export const findActiveWorkoutRow = (database: SQLite.SQLiteDatabase): Promise<WorkoutRow | null> =>
  database.getFirstAsync<WorkoutRow>(
    `SELECT ${WORKOUT_COLUMNS} FROM workouts WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`,
  );
