import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { colors } from '../styles/theme';
import type { SyncSettings } from '../types/domain';
import { formatDateTime } from '../utils/datetime';

// クラウドバックアップ（apps/api）との接続設定とバックアップ/復元の操作UI。
// 種目タブに置く。設定は app_settings に保存され同期対象外。
export function CloudSyncSection({
  syncSettings,
  onSaveConnection,
  onBackup,
  onRestore,
}: {
  syncSettings: SyncSettings;
  onSaveConnection: (apiUrl: string, apiToken: string) => Promise<void>;
  onBackup: () => Promise<void>;
  onRestore: () => Promise<void>;
}) {
  const [apiUrl, setApiUrl] = useState(syncSettings.apiUrl);
  const [apiToken, setApiToken] = useState(syncSettings.apiToken);
  const [isBusy, setIsBusy] = useState(false);

  const run = async (label: string, action: () => Promise<void>) => {
    setIsBusy(true);
    try {
      await action();
      Alert.alert(`${label}が完了しました`);
    } catch (error: unknown) {
      Alert.alert(`${label}に失敗しました`, error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  };

  const confirmRestore = () => {
    Alert.alert(
      'クラウドから復元',
      'この端末のデータをクラウドのバックアップで置き換えます。端末側の未バックアップ分は失われます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '復元', style: 'destructive', onPress: () => void run('復元', onRestore) },
      ],
    );
  };

  const lastBackupLabel = syncSettings.lastBackupAt
    ? formatDateTime(syncSettings.lastBackupAt)
    : '—';

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>クラウドバックアップ</Text>
        <Text style={styles.faint}>最終 {lastBackupLabel}</Text>
      </View>
      <View style={styles.sectionBody}>
        <Text style={styles.inputLabel}>API URL</Text>
        <TextInput
          value={apiUrl}
          onChangeText={setApiUrl}
          placeholder="https://workout-habit-api.example.workers.dev"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.textInput}
        />
        <Text style={styles.inputLabel}>APIトークン</Text>
        <TextInput
          value={apiToken}
          onChangeText={setApiToken}
          placeholder="トークン"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={styles.textInput}
        />
        <Pressable
          style={styles.ghostButton}
          disabled={isBusy}
          onPress={() => void run('接続設定の保存', () => onSaveConnection(apiUrl, apiToken))}
        >
          <Text style={styles.ghostButtonText}>接続設定を保存</Text>
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.secondaryButton, styles.flex]}
            disabled={isBusy}
            onPress={() => void run('バックアップ', onBackup)}
          >
            <Text style={styles.secondaryButtonText}>
              {isBusy ? '処理中…' : 'クラウドへバックアップ'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.dangerButton, styles.flex]}
            disabled={isBusy}
            onPress={confirmRestore}
          >
            <Text style={styles.dangerButtonText}>クラウドから復元</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
