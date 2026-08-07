// Worker の Bindings と Hono の型引数をここに集約する。
// Env は wrangler types が生成する型（D1 の DB binding を含む）。

import type { AuthBindings, AuthVariables } from './auth/types';

// ALLOWED_ORIGINS は管理画面のオリジンをカンマ区切りで持つシークレット。
// 値自体は秘密ではないが、workers.dev のサブドメインをリポジトリへ書かないため
// vars ではなく Secret に置く。未設定なら CORS ヘッダを出さず、ブラウザ側で弾かれる。
export type Bindings = Env & AuthBindings & { ALLOWED_ORIGINS?: string };

export type AppEnv = { Bindings: Bindings; Variables: AuthVariables };
