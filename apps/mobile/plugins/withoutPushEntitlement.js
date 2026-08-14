const { withEntitlementsPlist } = require('expo/config-plugins');

// `aps-environment`（Push Notifications capability）を entitlements から外す。
//
// **なぜ要るか。** 無料の Apple ID（Personal Team）はこの capability を扱えず、
// 実機ビルドが provisioning profile を作れずに失敗する
// （"Personal development teams ... do not support the Push Notifications capability."）。
// 一方 `expo-notifications` の config plugin は、この権限を無条件に付与する
// （mode の選択肢しかなく、付けない選択ができない）。
//
// **外して安全な理由。** このアプリが使うのは休憩終了の**ローカル通知だけ**で、
// リモートプッシュは使っていない。Apple のドキュメント上、`aps-environment` が要るのは
// APNs 登録（registerForRemoteNotifications）の経路だけで、ローカル通知の
// 許可要求・スケジュール・発火・カスタムサウンドは UNUserNotificationCenter 経由のため
// この権限に依存しない。expo-notifications の実装でも、リモート登録は
// getDevicePushTokenAsync からしか呼ばれない（このアプリは呼んでいない）。
//
// **app.json での置き場所に注意。** `expo-notifications` より**前**に置く。
// Expo の mod は登録順の逆（後に登録したものが先）に実行されるため、後ろに置くと
// 「削除 → expo-notifications が再付与」の順になって効かない。
//
// **将来 App Store へ出すとき（有料アカウント）はこのプラグインを外す。**
// 権限が無いまま提出すると TMS-90078 の警告が出ることがある。
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (entitlementsConfig) => {
    delete entitlementsConfig.modResults['aps-environment'];
    return entitlementsConfig;
  });
};
