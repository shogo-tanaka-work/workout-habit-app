import type * as SQLite from 'expo-sqlite';

import type { BodyPart, Exercise } from '../types/domain';
import { nowIso } from '../utils/datetime';

export const seedBodyParts: BodyPart[] = [
  { id: 'chest', name: '胸', orderIndex: 1 },
  { id: 'back', name: '背中', orderIndex: 2 },
  { id: 'legs', name: '脚', orderIndex: 3 },
  { id: 'shoulders', name: '肩', orderIndex: 4 },
  { id: 'arms', name: '腕', orderIndex: 5 },
  { id: 'core', name: '体幹', orderIndex: 6 },
  { id: 'cardio', name: '有酸素', orderIndex: 7 },
];

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
];

// マスタ（部位・種目）の初期投入。INSERT OR IGNORE のため何度実行しても重複しない。
export const seedMasters = async (database: SQLite.SQLiteDatabase): Promise<void> => {
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
