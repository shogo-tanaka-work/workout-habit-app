import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { colors } from '../styles/theme';
import type { SyncSettings } from '../types/domain';
import { formatDateTime } from '../utils/datetime';

// サーバ（apps/api）との接続設定と、手動同期／取り込みの操作UI。
// 種目タブに置く。設定は app_settings に保存され同期対象外。
//
// 記録は操作キューへ積まれ、種目の完了などの契機で自動送信される。
// ここにあるのは「自動を待たずに送る」「サーバの内容で作り直す」の2つだけ。
export function CloudSyncSection({
  syncSettings,
  pendingCount,
  onSaveConnection,
  onSyncNow,
  onRestore,
}: {
  syncSettings: SyncSettings;
  pendingCount: number;
  onSaveConnection: (apiUrl: string, apiToken: string) => Promise<void>;
  onSyncNow: () => Promise<void>;
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
      'サーバの内容で作り直す',
      'この端末のデータをサーバの内容で置き換えます。送信待ちの記録は失われます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '作り直す', style: 'destructive', onPress: () => void run('取り込み', onRestore) },
      ],
    );
  };

  const lastSyncLabel = syncSettings.lastBackupAt
    ? formatDateTime(syncSettings.lastBackupAt)
    : '—';

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>サーバとの同期</Text>
        <Text style={styles.faint}>
          {pendingCount > 0 ? `未送信 ${pendingCount}件` : `最終 ${lastSyncLabel}`}
        </Text>
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
            onPress={() => void run('同期', onSyncNow)}
          >
            <Text style={styles.secondaryButtonText}>{isBusy ? '処理中…' : '今すぐ同期'}</Text>
          </Pressable>
          <Pressable
            style={[styles.dangerButton, styles.flex]}
            disabled={isBusy}
            onPress={confirmRestore}
          >
            <Text style={styles.dangerButtonText}>サーバから取り込む</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
