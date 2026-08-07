import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// API は同一オリジンの /api/* 配下にある（配信元の workout-habit-admin Worker が
// Service Binding で workout-habit-api へ中継する）。CORS も接続先の設定も要らない。
//
// **`vite dev` では /api/* が 404 になる。** 中継役の Worker が居ないため。
// データを伴う確認は `npx wrangler dev` かデプロイ後の環境で行う（apps/web/AGENTS.md）。
export default defineConfig({
  plugins: [react()],
});
