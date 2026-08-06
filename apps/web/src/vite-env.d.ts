/// <reference types="vite/client" />

// ビルド時に注入される環境変数。env.example を .env.local へコピーして設定する。
interface ImportMetaEnv {
  /** API Worker（workout-habit-api）のオリジン。例: https://workout-habit-api.example.workers.dev */
  readonly VITE_API_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
