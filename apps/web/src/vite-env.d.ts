/// <reference types="vite/client" />

// API は同一オリジンの /api/* 配下にあり、配信元の Worker が中継する。
// そのため接続先を指定するビルド時変数は無く、import.meta.env も参照していない。
