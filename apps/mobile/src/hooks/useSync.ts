import { useCallback, useEffect } from 'react';

import {
  getIdToken,
  isGoogleSignInConfigured,
  signIn as signInWithGoogle,
  signOut as signOutFromGoogle,
} from '../auth/googleAuth';
import { markLastBackupAt, setSyncPaused, upsertSyncConnection } from '../db/appSettings';
import { countPendingOperations } from '../db/outbox';
import { fetchPlansFromCloud, replacePlannedWorkouts } from '../db/plans';
import { applyBackupPayload, fetchBackupFromCloud } from '../db/sync';
import { pushPendingOperations } from '../sync/pusher';
import type { SyncSettings } from '../types/domain';
import { formatDate, isoDatePlusDays, nowIso } from '../utils/datetime';
import type { WorkoutStore } from './useWorkoutStore';

// サーバとのやり取り。ログイン・送信・取り込み・復元をここへ集める。
//
// **記録の書き込みとは変更理由が別。** 送信の契機を変えたい、認証を足したい、
// といった変更がこのファイルだけで閉じるように分けている。
//
// 送信は失敗しても画面を止めない。積まれたまま次の契機で再送する
// （オフライン優先を崩さないため）。

// 未送信が残っているときの再送間隔。短すぎると圏外で無駄な試行を繰り返す。
const SYNC_RETRY_INTERVAL_MS = 60_000;

// 予定を取り込む期間。過去は取りこぼした予定を拾える程度に、先は数週間分だけ見る。
const PLAN_RANGE_DAYS_BACK = 7;
const PLAN_RANGE_DAYS_AHEAD = 28;

const planRange = (): { from: string; to: string } => {
  const today = formatDate(new Date());
  return {
    from: isoDatePlusDays(today, -PLAN_RANGE_DAYS_BACK),
    to: isoDatePlusDays(today, PLAN_RANGE_DAYS_AHEAD),
  };
};

export function useSync(store: WorkoutStore) {
  const {
    database,
    syncSettings,
    account,
    pendingSyncCount,
    reloadData,
    ensureDb,
    setSyncSettings,
    setAccount,
    setPendingSyncCount,
  } = store;

  // サーバの接続先を保存する。認証情報は端末に置かない。
  const updateSyncConnection = async (apiUrl: string) => {
    const database = ensureDb();
    await upsertSyncConnection(database, { apiUrl: apiUrl.trim() });
    setSyncSettings((previous) => ({ ...previous, apiUrl: apiUrl.trim() }));
  };

  const ensureSyncConnection = (): SyncSettings => {
    if (!syncSettings.apiUrl) {
      throw new Error('API URLを設定してください');
    }
    if (!account) {
      throw new Error('Google アカウントでログインしてください');
    }
    return syncSettings;
  };

  // Google サインイン。成功したらアカウントを保持し、溜まった操作を送る。

  // Google サインイン。成功したらアカウントを保持し、溜まった操作を送る。
  const signInToGoogle = async (): Promise<void> => {
    const signedIn = await signInWithGoogle();
    if (!signedIn) {
      return;
    }
    setAccount(signedIn);
    // ログイン前に溜まっていた操作をここで送る（オンライン復帰と同じ扱い）。
    void syncInBackground();
  };

  const signOutOfGoogle = async (): Promise<void> => {
    await signOutFromGoogle();
    setAccount(null);
  };

  // 送信待ちの操作をサーバへ送る。手動の「今すぐ同期」から呼ぶ。

  // 送信待ちの操作をサーバへ送る。手動の「今すぐ同期」から呼ぶ。
  const syncNow = async () => {
    const database = ensureDb();
    const connection = ensureSyncConnection();
    const result = await pushPendingOperations(database, {
      apiUrl: connection.apiUrl,
      getIdToken,
    });
    setPendingSyncCount(result.pending);
    if (result.settled > 0) {
      const timestamp = nowIso();
      await markLastBackupAt(database, timestamp);
      setSyncSettings((previous) => ({ ...previous, lastBackupAt: timestamp }));
    }
    if (result.failed > 0) {
      throw new Error(`${result.failed}件の操作がサーバに拒否されました`);
    }
  };

  // 自動送信の一時停止。**送信役だけを止める**ので、記録の保存処理は1実装のまま。
  // ローミング中や通信量を抑えたいときに使う。手動の「今すぐ同期」は止めない
  // （止めると、送り忘れた分が端末にしか存在しない状態を自分で作ることになる）。

  // 自動送信の一時停止。**送信役だけを止める**ので、記録の保存処理は1実装のまま。
  // ローミング中や通信量を抑えたいときに使う。手動の「今すぐ同期」は止めない
  // （止めると、送り忘れた分が端末にしか存在しない状態を自分で作ることになる）。
  const updateSyncPaused = async (isPaused: boolean): Promise<void> => {
    const database = ensureDb();
    await setSyncPaused(database, isPaused);
    setSyncSettings((previous) => ({ ...previous, isPaused }));
  };

  // 自動送信。契機（種目の全セット完了・ワークアウト完了・バックグラウンド遷移）から呼ぶ。
  // 失敗しても画面は止めない。積まれたまま次の契機で再送する。

  // 自動送信。契機（種目の全セット完了・ワークアウト完了・バックグラウンド遷移）から呼ぶ。
  // 失敗しても画面は止めない。積まれたまま次の契機で再送する。
  const syncInBackground = useCallback(async () => {
    if (!database || !syncSettings.apiUrl || !account || syncSettings.isPaused) {
      return;
    }
    try {
      const result = await pushPendingOperations(database, {
        apiUrl: syncSettings.apiUrl,
        getIdToken,
      });
      setPendingSyncCount(result.pending);
    } catch (error: unknown) {
      console.warn('[sync] 自動送信に失敗', error instanceof Error ? error.message : String(error));
      setPendingSyncCount(await countPendingOperations(database));
    }
  }, [database, syncSettings.apiUrl, account, syncSettings.isPaused, setPendingSyncCount]);

  // 未送信が残っている間だけ定期的に再送する。
  //
  // 他の契機（種目の完了・アプリの復帰・バックグラウンド遷移）はどれも操作か画面遷移が要る。
  // アプリを開いたまま通信が一時的に失敗すると、**次に画面を離れるまで送信されない**。
  // 定期リトライがあれば、その状態を利用者が気付かないうちに吸収できる。
  //
  // 未送信が 0 になればタイマーは張り直されない（常駐させない）。
  useEffect(() => {
    if (pendingSyncCount === 0) {
      return;
    }
    const timer = setInterval(() => void syncInBackground(), SYNC_RETRY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pendingSyncCount, syncInBackground]);

  // 予定の取り込み。**受信なので outbox には積まない**（src/db/plans.ts）。
  // 送信と違い、失敗しても端末には何も残らない。次の契機で取り直せばよい。

  // 予定の取り込み。**受信なので outbox には積まない**（src/db/plans.ts）。
  // 送信と違い、失敗しても端末には何も残らない。次の契機で取り直せばよい。
  const importPlansInBackground = useCallback(async () => {
    // 一時停止は通信量を抑えるための設定なので、受信も止める。手動の取り込みは止めない。
    if (!database || !syncSettings.apiUrl || !account || syncSettings.isPaused) {
      return;
    }
    try {
      const { from, to } = planRange();
      const payload = await fetchPlansFromCloud(syncSettings.apiUrl, await getIdToken(), from, to);
      await replacePlannedWorkouts(database, payload);
      await reloadData(database);
    } catch (error: unknown) {
      console.warn(
        '[plans] 予定の取り込みに失敗',
        error instanceof Error ? error.message : String(error),
      );
    }
  }, [database, syncSettings.apiUrl, account, syncSettings.isPaused, reloadData]);

  // 手動の取り込み。失敗を画面へ伝えたいので、こちらは例外を投げる。

  // 手動の取り込み。失敗を画面へ伝えたいので、こちらは例外を投げる。
  const importPlans = async (): Promise<void> => {
    const database = ensureDb();
    const connection = ensureSyncConnection();
    const { from, to } = planRange();
    const payload = await fetchPlansFromCloud(connection.apiUrl, await getIdToken(), from, to);
    await replacePlannedWorkouts(database, payload);
    await reloadData(database);
  };

  // 予定を開始して実績へ移す。開始した日の記録として残る。

  // クラウドのバックアップでローカルを置き換える（復元）。呼び出し側で確認ダイアログを出す。
  const restoreFromCloud = async () => {
    const database = ensureDb();
    const connection = ensureSyncConnection();
    const payload = await fetchBackupFromCloud(connection.apiUrl, await getIdToken());
    await applyBackupPayload(database, payload);
    await reloadData(database);
    setPendingSyncCount(0);
  };

  // 未送信が残っている間だけ定期的に再送する。圏外から戻ったときに、
  // 次の書き込みを待たずに送れるようにするため。
  useEffect(() => {
    if (pendingSyncCount === 0) {
      return;
    }
    const timer = setInterval(() => void syncInBackground(), SYNC_RETRY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pendingSyncCount, syncInBackground]);

  return {
    syncSettings,
    account,
    isGoogleSignInAvailable: isGoogleSignInConfigured(),
    ensureSyncConnection,
    updateSyncConnection,
    updateSyncPaused,
    signInToGoogle,
    signOutOfGoogle,
    syncNow,
    syncInBackground,
    importPlans,
    importPlansInBackground,
    restoreFromCloud,
  };
}
