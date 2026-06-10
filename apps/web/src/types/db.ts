// GET /backup が返す生データの型。
// 行は D1 から SELECT したままの snake_case で、欠損があり得る前提で
// Record<string, unknown> として受け、data/transform.ts の変換関数で型を保証する。

export type BackupRow = Record<string, unknown>;

export type BackupPayload = {
  exportedAt: string;
  tables: Record<string, BackupRow[]>;
};
