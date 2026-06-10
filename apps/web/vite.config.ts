import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 本番では apps/api（workout-habit-api Worker）の static assets として同一オリジン配信する。
// ローカル開発時のみ API パスを本番へプロキシして同一オリジン相当にする。
const API_ORIGIN = 'https://workout-habit-api.s-tanaka-dcb.workers.dev';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/analytics': { target: API_ORIGIN, changeOrigin: true },
      '/backup': { target: API_ORIGIN, changeOrigin: true },
      '/health': { target: API_ORIGIN, changeOrigin: true },
    },
  },
});
