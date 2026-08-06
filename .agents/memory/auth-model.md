# 認証モデル

Step 4 で実装する。現時点では **未実装**であり、以下はゴール像と論点の記録。

設計の詳細（認証・認可・スコープの分離、`users` テーブル、登録ポリシー、
守れること・守れないこと）は `docs/10_プロダクト設計/認証認可の設計.md` にある。実装前に読む。

## 現状（実装済み）

- `apps/api/src/index.ts` の唯一のミドルウェアが、`/health` 以外の全リクエストに対して
  `Authorization: Bearer <API_TOKEN>` を単純文字列比較で検証する
- トークンは1本のみ。ユーザーの概念が存在しない
- `/backup` は全テーブルを DELETE → INSERT で全置換する。マルチユーザーとは非互換
- D1 のどのテーブルにも `user_id` がない

## ゴール像

```text
ブラウザ（管理画面）
  -> Cloudflare Access（Google IdP）
  -> Access JWT を Worker へ付与
  -> Worker が team domain / AUD / 署名を再検証
  -> email からユーザーとロールを解決

モバイルアプリ
  -> @react-native-google-signin/google-signin で Google ログイン
  -> Google ID トークンを取得（expo-secure-store へ保存）
  -> Worker が Google の JWKS で署名・aud・iss を検証
  -> sub / email からユーザーとロールを解決
```

モバイル側は当初 `expo-auth-session` を想定していたが、SDK 53 以降の iOS で
リダイレクトから戻れない不具合が報告されており、ネイティブ向けの現行推奨は
`@react-native-google-signin/google-signin`。development build 運用のため導入自体は可能だが、
外部ライブラリの新規導入にあたるため `apps/mobile/AGENTS.md` の方針に従って正式に判断する。

Cloudflare Access はクッキーとブラウザリダイレクトを前提とするため、ネイティブアプリには使えない。
そのため二経路にする。どちらの経路でも、認証後に得るのは同じ「ユーザー ID + ロール」であり、
その先のビジネスロジックは経路を意識しない。

## ロール

| ロール | 対象 | できること |
|---|---|---|
| `admin` | 本人 | 全機能。全ユーザーのデータ閲覧、管理画面の全区画 |
| `member` | 一般ユーザー | 自分の記録の入力（モバイル）、成長推移の閲覧、AI による次回計画立案 |

管理画面は基本的に `admin` のみ。`member` に開放する区画は Step 4 の要件定義で確定する。

## 未確定事項

- `member` に開放する管理画面の区画の範囲
- 既存データ（`user_id` なし）を本人の `admin` ユーザーへ紐付ける移行手順
- `/backup` をユーザースコープの置換に変える際の、部分失敗時の回復方針
- ユーザー登録の入口（Access の招待制か、Google ログイン時の自動作成か）
- AI 計画立案のモデル選定とレート制限

## 実装時の不変条件

以下は方式が変わっても守る。

- 設定不足（Secret 未設定・JWKS 取得失敗）のときは fail closed にする。認証をスキップしない
- ローカル開発で検証を省略する場合、localhost 系のホスト名に限定する
- Secret の比較は通常の文字列比較ではなく Web Crypto による固定時間比較を使う
- 認証後のユーザー ID を、リクエストごとのコンテキストで持ち回る。モジュールスコープへ置かない
- `/backup` と `/analytics/*` は、認証済みユーザー自身のデータだけを対象にする（`admin` を除く）
