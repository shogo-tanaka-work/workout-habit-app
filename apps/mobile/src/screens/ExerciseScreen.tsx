import { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';

import type { GoogleAccount } from '../auth/googleAuth';
import { BodyPartPicker } from '../components/BodyPartPicker';
import { CloudSyncSection } from '../components/CloudSyncSection';
import { PlateCalculator } from '../components/PlateCalculator';
import { styles } from '../styles/appStyles';
import { colors } from '../styles/theme';
import type { BodyPart, Exercise, SyncSettings, TimerSettings } from '../types/domain';
import { formatTimer } from '../utils/format';

export function ExerciseScreen({
  bodyParts,
  exercises,
  bodyPartById,
  newExerciseName,
  timerSettings,
  onChangeNewExerciseName,
  onAddCustomExercise,
  onEditExercise,
  onOpenRestPicker,
  onSelectExercise,
  onUpdateTimerSettings,
  onExportCsv,
  syncSettings,
  pendingSyncCount,
  account,
  isGoogleSignInAvailable,
  onSaveSyncConnection,
  onSignIn,
  onSignOut,
  onSyncNow,
  onImportPlans,
  onTogglePaused,
  onRestore,
}: {
  bodyParts: BodyPart[];
  exercises: Exercise[];
  bodyPartById: Map<string, BodyPart>;
  newExerciseName: string;
  timerSettings: TimerSettings;
  onChangeNewExerciseName: (value: string) => void;
  onAddCustomExercise: (bodyPartId: string) => void;
  onEditExercise: (exerciseId: string) => void;
  onOpenRestPicker: (exerciseId: string, seconds: number) => void;
  onSelectExercise: (exerciseId: string) => void;
  onUpdateTimerSettings: (settings: TimerSettings) => void;
  onExportCsv: () => void;
  syncSettings: SyncSettings;
  pendingSyncCount: number;
  account: GoogleAccount | null;
  isGoogleSignInAvailable: boolean;
  onSaveSyncConnection: (apiUrl: string) => Promise<void>;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onImportPlans: () => Promise<void>;
  onTogglePaused: (isPaused: boolean) => Promise<void>;
  onRestore: () => Promise<void>;
}) {
  // 新規登録の入力状態。名前は親（App）が持つが、部位とフィルタはこの画面だけの関心。
  const [newBodyPartId, setNewBodyPartId] = useState(bodyParts[0]?.id ?? '');
  const [keyword, setKeyword] = useState('');
  const [filterBodyPartId, setFilterBodyPartId] = useState<string | null>(null);

  const normalizedKeyword = keyword.trim().toLowerCase();
  const matchesFilter = (exercise: Exercise): boolean =>
    (filterBodyPartId === null || exercise.primaryBodyPartId === filterBodyPartId) &&
    (normalizedKeyword === '' || exercise.name.toLowerCase().includes(normalizedKeyword));

  const listedExercises = exercises
    .filter((exercise) => !exercise.isArchived)
    .filter(matchesFilter);
  const archivedExercises = exercises.filter((exercise) => exercise.isArchived);

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>タイマー設定</Text>
        </View>
        <View style={styles.sectionBody}>
          <View style={styles.rowBetween}>
            <Text style={styles.panelText}>終了時に音を鳴らす</Text>
            <Switch
              value={timerSettings.soundEnabled}
              onValueChange={(soundEnabled) =>
                onUpdateTimerSettings({ ...timerSettings, soundEnabled })
              }
              trackColor={{ true: colors.accent, false: colors.surfaceRaised }}
            />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.panelText}>終了時に振動する</Text>
            <Switch
              value={timerSettings.vibrationEnabled}
              onValueChange={(vibrationEnabled) =>
                onUpdateTimerSettings({ ...timerSettings, vibrationEnabled })
              }
              trackColor={{ true: colors.accent, false: colors.surfaceRaised }}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>種目を追加</Text>
        </View>
        <View style={styles.sectionBody}>
          <TextInput
            value={newExerciseName}
            onChangeText={onChangeNewExerciseName}
            placeholder="例: インクラインダンベルプレス"
            placeholderTextColor={colors.textFaint}
            style={styles.textInput}
          />
          <Text style={styles.inputLabel}>部位</Text>
          <BodyPartPicker
            bodyParts={bodyParts}
            selectedId={newBodyPartId}
            onSelect={setNewBodyPartId}
          />
          <Pressable
            style={styles.primaryButton}
            onPress={() => onAddCustomExercise(newBodyPartId)}
          >
            <Text style={styles.primaryButtonText}>種目を登録</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>種目一覧</Text>
          <Text style={styles.faint}>{listedExercises.length} 件</Text>
        </View>
        <View style={styles.sectionBody}>
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            placeholder="種目名で絞り込む"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.textInput}
          />
          <View style={styles.chipWrap}>
            <Pressable
              style={[styles.pill, filterBodyPartId === null && styles.activePill]}
              onPress={() => setFilterBodyPartId(null)}
            >
              <Text style={[styles.pillText, filterBodyPartId === null && styles.activePillText]}>
                すべて
              </Text>
            </Pressable>
            {bodyParts.map((part) => (
              <Pressable
                key={part.id}
                style={[styles.pill, filterBodyPartId === part.id && styles.activePill]}
                onPress={() => setFilterBodyPartId(filterBodyPartId === part.id ? null : part.id)}
              >
                <Text
                  style={[styles.pillText, filterBodyPartId === part.id && styles.activePillText]}
                >
                  {part.name}
                </Text>
              </Pressable>
            ))}
          </View>
          {listedExercises.length === 0 ? (
            <Text style={styles.muted}>条件に合う種目がありません。</Text>
          ) : null}
        </View>
        {listedExercises.map((exercise) => {
          const bodyPart = bodyPartById.get(exercise.primaryBodyPartId);
          return (
            <View key={exercise.id} style={styles.exerciseRow}>
              <Pressable
                style={styles.exerciseRowHeader}
                onPress={() => onSelectExercise(exercise.id)}
              >
                <View style={styles.exerciseDot} />
                <View style={styles.flex}>
                  <Text style={styles.exerciseRowName}>{exercise.name}</Text>
                  <Text style={styles.faint}>
                    {bodyPart?.name ?? '未分類'} ・ バー {exercise.defaultBarWeightKg} kg
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
              <View style={styles.sectionBody}>
                <Pressable
                  style={styles.restRow}
                  onPress={() => onOpenRestPicker(exercise.id, exercise.defaultRestSeconds)}
                >
                  <Text style={styles.muted}>デフォルト休憩</Text>
                  <Text style={styles.restValue}>{formatTimer(exercise.defaultRestSeconds)} ›</Text>
                </Pressable>
                <Pressable style={styles.restRow} onPress={() => onEditExercise(exercise.id)}>
                  <Text style={styles.muted}>設定</Text>
                  <Text style={styles.restValue}>編集 ›</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      {/* アーカイブ済み。読み込み対象に含めているので、ここから戻せる。 */}
      {archivedExercises.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>アーカイブ済み</Text>
            <Text style={styles.faint}>{archivedExercises.length} 件</Text>
          </View>
          {archivedExercises.map((exercise) => (
            <View key={exercise.id} style={styles.exerciseRow}>
              <Pressable
                style={styles.exerciseRowHeader}
                onPress={() => onEditExercise(exercise.id)}
              >
                <View style={styles.flex}>
                  <Text style={styles.exerciseRowName}>{exercise.name}</Text>
                  <Text style={styles.faint}>選択肢に出ません</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <PlateCalculator />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>データ</Text>
        </View>
        <View style={styles.sectionBody}>
          <Pressable style={styles.ghostButton} onPress={onExportCsv}>
            <Text style={styles.ghostButtonText}>ワークアウト記録をCSVで書き出す</Text>
          </Pressable>
          <Text style={styles.faint}>
            完了済みの全記録を共有シートからファイル・AirDrop・メールなどへ出力できます。
          </Text>
        </View>
      </View>

      <CloudSyncSection
        syncSettings={syncSettings}
        pendingCount={pendingSyncCount}
        account={account}
        isGoogleSignInAvailable={isGoogleSignInAvailable}
        onSaveConnection={onSaveSyncConnection}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        onSyncNow={onSyncNow}
        onImportPlans={onImportPlans}
        onTogglePaused={onTogglePaused}
        onRestore={onRestore}
      />
    </View>
  );
}
