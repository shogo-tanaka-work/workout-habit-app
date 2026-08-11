import * as Notifications from 'expo-notifications';

// 休憩終了のローカル通知。
//
// **これが無いとタイマーは肝心の場面で機能しない。** setInterval と expo-audio は
// アプリが前面にある間しか動かず、休憩中に画面を消してポケットへ入れると
// カウントも進まず音も鳴らない。休憩中に画面を消すのは自然な行為なので、
// OS に時刻を預けて鳴らしてもらう。
//
// 前面にいるときは通知を出さない（アプリ内の音と振動が既に鳴っており、二重になる）。

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

/** 予約中の通知 ID。同時に走る休憩タイマーは1つなので1件だけ持つ。 */
let scheduledId: string | null = null;

/**
 * 通知の許可を求める。すでに決まっていれば聞き直さない。
 * **拒否されても失敗にしない。** 通知が無くてもタイマー自体は使えるため。
 */
const ensurePermission = async (): Promise<boolean> => {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      return true;
    }
    if (!current.canAskAgain) {
      return false;
    }
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch (error) {
    console.warn(
      '[timer] 通知の許可確認に失敗',
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
};

/**
 * 休憩終了の通知を予約する。既存の予約は先に取り消す。
 * @param secondsFromNow 何秒後に鳴らすか。0 以下なら予約しない。
 */
export const scheduleRestFinished = async (
  exerciseName: string,
  secondsFromNow: number,
): Promise<void> => {
  await cancelRestFinished();
  if (secondsFromNow <= 0) {
    return;
  }
  if (!(await ensurePermission())) {
    return;
  }
  try {
    scheduledId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '休憩終了',
        body: `${exerciseName} の次のセットへ`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.ceil(secondsFromNow),
      },
    });
  } catch (error) {
    // 通知が出せなくてもタイマーは動く。画面を止めない。
    console.warn(
      '[timer] 通知の予約に失敗',
      error instanceof Error ? error.message : String(error),
    );
  }
};

/** 予約済みの通知を取り消す。一時停止・閉じる・前面での完了で呼ぶ。 */
export const cancelRestFinished = async (): Promise<void> => {
  if (!scheduledId) {
    return;
  }
  const id = scheduledId;
  scheduledId = null;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (error) {
    console.warn(
      '[timer] 通知の取り消しに失敗',
      error instanceof Error ? error.message : String(error),
    );
  }
};
