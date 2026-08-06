import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// 本番では apps/api（workout-habit-api Worker）の static assets として同一オリジン配信するため、
// プロキシは不要。ローカル開発時のみ API パスをデプロイ済み Worker へ転送して同一オリジン相当にする。
// 転送先は .env.local の VITE_API_ORIGIN で指定する（env.example を参照）。
const PROXY_PATHS = ['/analytics', '/backup', '/health'] as const;

export default defineConfig(({ mode }) => {
  // envDir は実行時の作業ディレクトリ基準。npm scripts は apps/web で実行されるため '.' でよい。
  const env = loadEnv(mode, '.', 'VITE_');
  const apiOrigin = env.VITE_API_ORIGIN;

  if (!apiOrigin) {
    console.warn(
      '[vite] VITE_API_ORIGIN が未設定のため、API プロキシを無効にします。' +
        ' ローカルで分析データを表示するには env.example を .env.local へコピーして値を設定してください。',
    );
  }

  return {
    plugins: [react()],
    server: apiOrigin
      ? {
          proxy: Object.fromEntries(
            PROXY_PATHS.map((path) => [path, { target: apiOrigin, changeOrigin: true }]),
          ),
        }
      : {},
  };
});
