// 行レベルのスコープ（3段目）。
//
// 各エンドポイントに WHERE user_id = ? を散らさず、条件の作り方をここに集約する。
// 散らすと、追加したエンドポイントで書き忘れた瞬間に他人のデータが漏れる。
//
// 列名は呼び出し側のリテラルだけを受け取る。外部入力を渡してはならない。

import type { AuthenticatedUser } from '../auth/types';

export type Scope = {
  /** WHERE へ AND で連結できる条件式。 */
  condition: string;
  /** condition 中の ? に対応するバインド値。SQL の先頭側に置く前提で使う。 */
  params: readonly string[];
};

/** 常に真の条件。admin（全件閲覧）で使う。 */
const UNRESTRICTED: Scope = { condition: '1 = 1', params: [] };

/**
 * 記録テーブル用のスコープ。member は自分の行だけ、admin は全件。
 * @param column 修飾済みの列名（例: 'w.user_id'）。呼び出し側のリテラルであること。
 */
export const scopeForUser = (user: AuthenticatedUser, column: string): Scope =>
  user.role === 'admin' ? UNRESTRICTED : { condition: `${column} = ?`, params: [user.id] };

/**
 * 種目マスタ用のスコープ。owner_user_id が NULL の行は全ユーザー共有のプリセット、
 * 非 NULL はそのユーザーのカスタム種目。
 * @param column 修飾済みの列名（例: 'e.owner_user_id'）。
 */
export const scopeForExercise = (user: AuthenticatedUser, column: string): Scope =>
  user.role === 'admin'
    ? UNRESTRICTED
    : { condition: `(${column} IS NULL OR ${column} = ?)`, params: [user.id] };
