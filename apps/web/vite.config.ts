import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 本番では apps/api（workout-habit-api Worker）の static assets として同一オリジン配信する。
// ローカル開発時のみ /backup を本番 API へプロキシして同一オリジン相当にする。
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/backup': {
        target: 'https://workout-habit-api.s-tanaka-dcb.workers.dev',
        changeOrigin: true,
      },
      '/health': {
        target: 'https://workout-habit-api.s-tanaka-dcb.workers.dev',
        changeOrigin: true,
      },
    },
  },
});
