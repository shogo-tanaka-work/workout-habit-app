// app.json の静的設定に、環境依存の値を上書きする。
//
// Google OAuth のクライアント ID はリポジトリへ書かない（.agents/rules/secrets.md）。
// ローカルでは apps/mobile/.env.local に置き、EAS ではビルド環境変数として渡す。
//
//   EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.xxxxxxxx
//   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
//   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
//
// iosUrlScheme は iOS 用 OAuth クライアントの REVERSED_CLIENT_ID。
// 未設定でもアプリはビルドできるが、Google サインインは開始できない（fail closed）。

const GOOGLE_SIGN_IN_PLUGIN = '@react-native-google-signin/google-signin';

const withGoogleSignInScheme = (plugins) => {
  const iosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  if (!iosUrlScheme) {
    return plugins;
  }
  return plugins.map((plugin) =>
    plugin === GOOGLE_SIGN_IN_PLUGIN ? [GOOGLE_SIGN_IN_PLUGIN, { iosUrlScheme }] : plugin,
  );
};

module.exports = ({ config }) => ({
  ...config,
  plugins: withGoogleSignInScheme(config.plugins ?? []),
});
