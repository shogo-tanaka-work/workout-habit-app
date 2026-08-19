import type * as SQLite from 'expo-sqlite';

import type {
  BodyLog,
  BodyPart,
  Exercise,
  SyncSettings,
  Template,
  TemplateExercise,
  TimerSettings,
  TrainingPhase,
  UserExerciseSetting,
  UserProfile,
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
  TrainingPhaseRow,
  UserExerciseSettingRow,
  UserProfileRow,
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
  toTrainingPhase,
  toUserExerciseSetting,
  toUserProfile,
  toWorkout,
  toWorkoutExercise,
  toWorkoutSet,
} from './mappers';

// 端末 DB の読み取り。**書き込みは db/queries.ts が持つ。**
//
// テーブル単位で読み直せるようにしている。書き込みのたびに全テーブルを読み直すと、
// 全 state の参照が変わって無関係な画面まで再レンダリングされるため、
// 呼び出し側は「書き込んだテーブルだけ」を指定して読み直す。

export type WorkoutData = {
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
  /** 基本情報は端末に0行または1行。未設定を null で配る。 */
  userProfile: UserProfile | null;
  /** フェーズ履歴（開始日の新しい順）。現在のフェーズの判定は useWorkoutStore が持つ。 */
  trainingPhases: TrainingPhase[];
};

/** 再読込を指定できるテーブル。書き込み後は、書き込んだテーブルだけを渡す。 */
export const ALL_WORKOUT_TABLES = [
  'body_parts',
  'exercises',
  'user_exercise_settings',
  'workouts',
  'workout_exercises',
  'workout_sets',
  'templates',
  'template_exercises',
  'app_settings',
  'body_logs',
  'user_profile',
  'training_phases',
] as const;

export type WorkoutTable = (typeof ALL_WORKOUT_TABLES)[number];

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

const USER_PROFILE_COLUMNS = 'id, training_goal, height_cm, gym_monthly_fee_yen, note';

const TRAINING_PHASE_COLUMNS = 'id, phase, started_on, ended_on, note';

// 種目は上書き（user_exercise_settings）を畳み込んでから配るため、
// どちらか一方だけが変わっても両テーブルを読み直す（2つのテーブルで1つのローダーを共有）。
const loadExercisesWithOverrides = async (
  database: SQLite.SQLiteDatabase,
): Promise<Partial<WorkoutData>> => {
  const [exerciseRows, settingRows] = await Promise.all([
    database.getAllAsync<ExerciseRow>(
      // アーカイブ済みも読み込む。除外すると戻す手段が無くなるうえ、
      // 過去の記録から種目名を引けなくなる。表示側で絞る。
      `SELECT ${EXERCISE_COLUMNS} FROM exercises ORDER BY name`,
    ),
    database.getAllAsync<UserExerciseSettingRow>(
      `SELECT ${USER_EXERCISE_SETTING_COLUMNS} FROM user_exercise_settings`,
    ),
  ]);
  const settings = settingRows.map(toUserExerciseSetting);
  const settingByExerciseId = new Map(settings.map((setting) => [setting.exerciseId, setting]));
  return {
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
  };
};

type TableLoader = (database: SQLite.SQLiteDatabase) => Promise<Partial<WorkoutData>>;

const TABLE_LOADERS: Record<WorkoutTable, TableLoader> = {
  body_parts: async (database) => ({
    bodyParts: (
      await database.getAllAsync<BodyPartRow>(
        `SELECT ${BODY_PART_COLUMNS} FROM body_parts ORDER BY order_index`,
      )
    ).map(toBodyPart),
  }),
  exercises: loadExercisesWithOverrides,
  user_exercise_settings: loadExercisesWithOverrides,
  workouts: async (database) => ({
    workouts: (
      await database.getAllAsync<WorkoutRow>(
        `SELECT ${WORKOUT_COLUMNS} FROM workouts ORDER BY created_at DESC`,
      )
    ).map(toWorkout),
  }),
  workout_exercises: async (database) => ({
    workoutExercises: (
      await database.getAllAsync<WorkoutExerciseRow>(
        `SELECT ${WORKOUT_EXERCISE_COLUMNS} FROM workout_exercises ORDER BY order_index`,
      )
    ).map(toWorkoutExercise),
  }),
  workout_sets: async (database) => ({
    workoutSets: (
      await database.getAllAsync<WorkoutSetRow>(
        `SELECT ${WORKOUT_SET_COLUMNS} FROM workout_sets ORDER BY order_index`,
      )
    ).map(toWorkoutSet),
  }),
  templates: async (database) => ({
    templates: (
      await database.getAllAsync<TemplateRow>(
        `SELECT ${TEMPLATE_COLUMNS} FROM templates ORDER BY created_at DESC`,
      )
    ).map(toTemplate),
  }),
  template_exercises: async (database) => ({
    templateExercises: (
      await database.getAllAsync<TemplateExerciseRow>(
        `SELECT ${TEMPLATE_EXERCISE_COLUMNS} FROM template_exercises ORDER BY order_index`,
      )
    ).map(toTemplateExercise),
  }),
  app_settings: async (database) => {
    const appSettingRows = await database.getAllAsync<AppSettingRow>(
      'SELECT key, value FROM app_settings',
    );
    return {
      timerSettings: toTimerSettings(appSettingRows),
      syncSettings: toSyncSettings(appSettingRows),
    };
  },
  body_logs: async (database) => ({
    bodyLogs: (
      await database.getAllAsync<BodyLogRow>(
        'SELECT id, measured_at, body_weight_kg, body_fat_percentage, memo FROM body_logs ORDER BY measured_at DESC',
      )
    ).map(toBodyLog),
  }),
  // 端末は1行しか持たない。未設定（0行）は null を配る。
  user_profile: async (database) => {
    const row = await database.getFirstAsync<UserProfileRow>(
      `SELECT ${USER_PROFILE_COLUMNS} FROM user_profile LIMIT 1`,
    );
    return { userProfile: row ? toUserProfile(row) : null };
  },
  training_phases: async (database) => ({
    trainingPhases: (
      await database.getAllAsync<TrainingPhaseRow>(
        `SELECT ${TRAINING_PHASE_COLUMNS} FROM training_phases ORDER BY started_on DESC`,
      )
    ).map(toTrainingPhase),
  }),
};

/** 指定したテーブルだけを読み直す。ローダーを共有するテーブルの重複は1回にまとめる。 */
export const loadWorkoutTables = async (
  database: SQLite.SQLiteDatabase,
  tables: readonly WorkoutTable[],
): Promise<Partial<WorkoutData>> => {
  const loaders = [...new Set(tables.map((table) => TABLE_LOADERS[table]))];
  const parts = await Promise.all(loaders.map((load) => load(database)));
  return parts.reduce<Partial<WorkoutData>>((merged, part) => ({ ...merged, ...part }), {});
};

export const findActiveWorkoutRow = (database: SQLite.SQLiteDatabase): Promise<WorkoutRow | null> =>
  database.getFirstAsync<WorkoutRow>(
    `SELECT ${WORKOUT_COLUMNS} FROM workouts WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`,
  );
