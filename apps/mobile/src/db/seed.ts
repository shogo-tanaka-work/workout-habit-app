import type * as SQLite from 'expo-sqlite';

import type { BodyPart, Exercise } from '../types/domain';
import { nowIso } from '../utils/datetime';

import { runSerialized } from './writeQueue';

export const seedBodyParts: BodyPart[] = [
  { id: 'chest', name: '胸', orderIndex: 1 },
  { id: 'back', name: '背中', orderIndex: 2 },
  { id: 'legs', name: '脚', orderIndex: 3 },
  { id: 'shoulders', name: '肩', orderIndex: 4 },
  { id: 'arms', name: '腕', orderIndex: 5 },
  { id: 'core', name: '体幹', orderIndex: 6 },
  { id: 'cardio', name: '有酸素', orderIndex: 7 },
];

// 共有プリセットの種目。**apps/api の D1 と同じ内容を保つ**（片方だけ変えない）。
// 端末は起動時にこれを INSERT OR IGNORE で入れ、サーバからの取り込みでも同じ行が来る。
export const seedExercises: Exercise[] = [
  {
    id: 'bench-press',
    name: 'ベンチプレス',
    primaryBodyPartId: 'chest',
    defaultRestSeconds: 120,
    defaultBarWeightKg: 20,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'deadlift',
    name: 'デッドリフト',
    primaryBodyPartId: 'back',
    defaultRestSeconds: 180,
    defaultBarWeightKg: 20,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'squat',
    name: 'スクワット',
    primaryBodyPartId: 'legs',
    defaultRestSeconds: 180,
    defaultBarWeightKg: 20,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'pull-up',
    name: '懸垂',
    primaryBodyPartId: 'back',
    defaultRestSeconds: 120,
    defaultBarWeightKg: 0,
    category: 'bodyweight',
    isArchived: false,
  },
  {
    id: 'dumbbell-press',
    name: 'ダンベルプレス',
    primaryBodyPartId: 'chest',
    defaultRestSeconds: 90,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'shoulder-press',
    name: 'ショルダープレス',
    primaryBodyPartId: 'shoulders',
    defaultRestSeconds: 90,
    defaultBarWeightKg: 20,
    category: 'strength',
    isArchived: false,
  },

  {
    id: 'feet-up-bench-press',
    name: 'ベンチプレス(足上げ)',
    primaryBodyPartId: 'chest',
    defaultRestSeconds: 120,
    defaultBarWeightKg: 20,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'narrow-bench-press',
    name: 'ナローベンチプレス',
    primaryBodyPartId: 'chest',
    defaultRestSeconds: 120,
    defaultBarWeightKg: 20,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'incline-dumbbell-press',
    name: 'インクラインダンベルプレス',
    primaryBodyPartId: 'chest',
    defaultRestSeconds: 90,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'single-arm-dumbbell-press',
    name: 'ダンベルプレス(片手)',
    primaryBodyPartId: 'chest',
    defaultRestSeconds: 90,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'dips',
    name: 'ディップス',
    primaryBodyPartId: 'chest',
    defaultRestSeconds: 120,
    defaultBarWeightKg: 0,
    category: 'bodyweight',
    isArchived: false,
  },
  {
    id: 'bent-over-row',
    name: 'ベントオーバーロウ',
    primaryBodyPartId: 'back',
    defaultRestSeconds: 120,
    defaultBarWeightKg: 20,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'inverted-row',
    name: 'インバーテッドロウ',
    primaryBodyPartId: 'back',
    defaultRestSeconds: 90,
    defaultBarWeightKg: 0,
    category: 'bodyweight',
    isArchived: false,
  },
  {
    id: 'dumbbell-row',
    name: 'ダンベルローイング',
    primaryBodyPartId: 'back',
    defaultRestSeconds: 90,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'seated-row',
    name: 'シーテッドローイング',
    primaryBodyPartId: 'back',
    defaultRestSeconds: 90,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'v-squat',
    name: 'vスクワット',
    primaryBodyPartId: 'legs',
    defaultRestSeconds: 150,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'power-clean',
    name: 'パワークリーン',
    primaryBodyPartId: 'legs',
    defaultRestSeconds: 180,
    defaultBarWeightKg: 20,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'belt-squat',
    name: 'ベルトスクワット',
    primaryBodyPartId: 'legs',
    defaultRestSeconds: 150,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'pause-squat',
    name: 'ポーズスクワット',
    primaryBodyPartId: 'legs',
    defaultRestSeconds: 180,
    defaultBarWeightKg: 20,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'bulgarian-squat',
    name: 'ブルガリアンスクワット',
    primaryBodyPartId: 'legs',
    defaultRestSeconds: 90,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'calf-raise',
    name: 'カーフレイズ',
    primaryBodyPartId: 'legs',
    defaultRestSeconds: 60,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'lunge',
    name: 'ランジ',
    primaryBodyPartId: 'legs',
    defaultRestSeconds: 90,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'leg-press',
    name: 'レッグプレス',
    primaryBodyPartId: 'legs',
    defaultRestSeconds: 120,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'barbell-curl',
    name: 'バーベルカール',
    primaryBodyPartId: 'arms',
    defaultRestSeconds: 90,
    defaultBarWeightKg: 20,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'hammer-curl',
    name: 'ハンマーカール',
    primaryBodyPartId: 'arms',
    defaultRestSeconds: 60,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'cable-arm-curl',
    name: 'ケーブルアームカール',
    primaryBodyPartId: 'arms',
    defaultRestSeconds: 60,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'cable-pressdown',
    name: 'ケーブルプレスダウン',
    primaryBodyPartId: 'arms',
    defaultRestSeconds: 60,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'dumbbell-triceps-extension',
    name: 'ダンベルトライセプスエクステンション',
    primaryBodyPartId: 'arms',
    defaultRestSeconds: 60,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'incline-bench-press',
    name: 'インクラインベンチプレス',
    primaryBodyPartId: 'chest',
    defaultRestSeconds: 120,
    defaultBarWeightKg: 20,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'front-squat',
    name: 'フロントスクワット',
    primaryBodyPartId: 'legs',
    defaultRestSeconds: 180,
    defaultBarWeightKg: 20,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'jump-squat',
    name: 'ジャンプスクワット',
    primaryBodyPartId: 'legs',
    defaultRestSeconds: 90,
    defaultBarWeightKg: 0,
    category: 'bodyweight',
    isArchived: false,
  },
  {
    id: 'dumbbell-shoulder-press',
    name: 'ダンベルショルダープレス',
    primaryBodyPartId: 'shoulders',
    defaultRestSeconds: 90,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'rear-raise',
    name: 'リアレイズ',
    primaryBodyPartId: 'shoulders',
    defaultRestSeconds: 60,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'dumbbell-curl',
    name: 'ダンベルカール',
    primaryBodyPartId: 'arms',
    defaultRestSeconds: 60,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'skull-crusher',
    name: 'スカルクラッシャー',
    primaryBodyPartId: 'arms',
    defaultRestSeconds: 60,
    defaultBarWeightKg: 20,
    category: 'strength',
    isArchived: false,
  },
  // 体幹。部位（core）は最初から定義しているのに種目が1件も無く、記録する器が無かった。
  // 高重量スクワット・デッドリフトの土台であり、クロスフィットのような複合種目にも直結する。
  {
    id: 'ab-roller',
    name: 'アブローラー',
    primaryBodyPartId: 'core',
    defaultRestSeconds: 60,
    defaultBarWeightKg: 0,
    category: 'bodyweight',
    isArchived: false,
  },
  {
    id: 'hanging-leg-raise',
    name: 'ハンギングレッグレイズ',
    primaryBodyPartId: 'core',
    defaultRestSeconds: 60,
    defaultBarWeightKg: 0,
    category: 'bodyweight',
    isArchived: false,
  },
  {
    // 体幹で唯一、重量で漸進できる種目。ボリュームと推定1RM が意味を持つのはここだけ。
    id: 'cable-crunch',
    name: 'ケーブルクランチ',
    primaryBodyPartId: 'core',
    defaultRestSeconds: 60,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    // 時間で計る種目。回数欄を秒として記録する（重量は 0 のまま）。
    id: 'plank',
    name: 'プランク',
    primaryBodyPartId: 'core',
    defaultRestSeconds: 60,
    defaultBarWeightKg: 0,
    category: 'bodyweight',
    isArchived: false,
  },
  // 有酸素。部位（cardio）は最初から定義しているのに種目が1件も無く、
  // クロスフィットで実施した内容を記録する器が無かった。
  //
  // **距離と時間の列がスキーマに無い。** プランクと同じ考え方で、回数欄を「本数」
  // （インターバルなら1本＝1セット）として使い、距離や時間はセットのメモへ書く。
  // 重量は 0 のままなので、ボリュームと推定1RM を歪めない
  // （筋力の指標に有酸素が混ざらない）。
  {
    id: 'rowing',
    name: 'ローイング',
    primaryBodyPartId: 'cardio',
    defaultRestSeconds: 120,
    defaultBarWeightKg: 0,
    category: 'cardio',
    isArchived: false,
  },
  {
    id: 'air-bike',
    name: 'エアバイク',
    primaryBodyPartId: 'cardio',
    defaultRestSeconds: 120,
    defaultBarWeightKg: 0,
    category: 'cardio',
    isArchived: false,
  },
  {
    id: 'ski-erg',
    name: 'スキーエルグ',
    primaryBodyPartId: 'cardio',
    defaultRestSeconds: 120,
    defaultBarWeightKg: 0,
    category: 'cardio',
    isArchived: false,
  },
  {
    id: 'running',
    name: 'ラン',
    primaryBodyPartId: 'cardio',
    defaultRestSeconds: 60,
    defaultBarWeightKg: 0,
    category: 'cardio',
    isArchived: false,
  },
  {
    id: 'jump-rope',
    name: '縄跳び',
    primaryBodyPartId: 'cardio',
    defaultRestSeconds: 60,
    defaultBarWeightKg: 0,
    category: 'cardio',
    isArchived: false,
  },
  {
    id: 'burpee',
    name: 'バーピー',
    primaryBodyPartId: 'cardio',
    defaultRestSeconds: 60,
    defaultBarWeightKg: 0,
    category: 'cardio',
    isArchived: false,
  },
];

// マスタ（部位・種目）の初期投入。INSERT OR IGNORE のため何度実行しても重複しない。
// 毎起動で走るため、1トランザクションでまとめて42文ぶんの個別コミットを避ける。
export const seedMasters = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  // 記録の書き込みと同じキューに載せる（理由は db/writeQueue.ts）。
  const insertMasters = async () => {
    for (const bodyPart of seedBodyParts) {
      await database.runAsync(
        'INSERT OR IGNORE INTO body_parts (id, name, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        bodyPart.id,
        bodyPart.name,
        bodyPart.orderIndex,
        nowIso(),
        nowIso(),
      );
    }
    for (const exercise of seedExercises) {
      await database.runAsync(
        `INSERT OR IGNORE INTO exercises
            (id, name, primary_body_part_id, default_rest_seconds, default_bar_weight_kg, category, is_archived, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        exercise.id,
        exercise.name,
        exercise.primaryBodyPartId,
        exercise.defaultRestSeconds,
        exercise.defaultBarWeightKg,
        exercise.category,
        exercise.isArchived ? 1 : 0,
        nowIso(),
        nowIso(),
      );
    }
  };

  try {
    await runSerialized(database, () => database.withTransactionAsync(insertMasters));
  } catch (error) {
    throw new Error(
      `seedMasters failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
};
