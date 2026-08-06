import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// API は別オリジンの workout-habit-api Worker にあり、接続先は
// VITE_API_ORIGIN（env.example を .env.local へコピーして設定）で与える。
// 開発時もプロキシを挟まず本番と同じ経路（絶対 URL + CORS）を通す。
// 経路を揃えておくと、CORS の設定漏れを開発中に気づける。
export default defineConfig({
  plugins: [react()],
});
