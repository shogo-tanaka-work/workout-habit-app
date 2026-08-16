import type * as SQLite from 'expo-sqlite';

// 書き込みトランザクションを、DB 接続ごとに1本ずつ流すキュー。
//
// **`withTransactionAsync` は排他ではない。** 別の書き込みが割り込むと BEGIN / COMMIT が
// 交錯し、後から COMMIT した側が
// `SQLiteErrorException: cannot rollback - no transaction is active` で落ちる。
// 実機では「セットのメモを打つ」「完了を付ける」と背景同期が重なったときに出ていた。
//
// `withExclusiveTransactionAsync` では解決しない。あちらは競合した側を
// `database is locked` で失敗させるだけで、順番待ちはしてくれない。
// 待たせたいのはこちらの都合なので、アプリ側で直列化する。
//
// 読み取り（`getAllAsync` など）はここを通さない。書き込みと並行に走っても壊れず、
// 通すと画面の再読み込みが書き込みの完了を待つことになる。

/** DB 接続ごとの「最後に積んだ処理」。接続が捨てられたら一緒に消える。 */
const tailByDatabase = new WeakMap<SQLite.SQLiteDatabase, Promise<unknown>>();

/**
 * 前の書き込みが終わってから `task` を実行する。
 *
 * 前の書き込みが失敗しても後続は流す（1つのエラーで以降の記録が全部止まるのを避ける）。
 * 呼び出し側はこれまでどおり自分の Promise の失敗だけを見ればよい。
 */
export const runSerialized = async <T>(
  database: SQLite.SQLiteDatabase,
  task: () => Promise<T>,
): Promise<T> => {
  const previous = tailByDatabase.get(database) ?? Promise.resolve();
  const result = previous.then(task, task);
  tailByDatabase.set(
    database,
    result.catch(() => undefined),
  );
  return result;
};
