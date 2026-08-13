// Worker の Bindings と Hono の型引数をここに集約する。
// Env は wrangler types が生成する型（D1 の DB binding を含む）。

import type { AuthBindings, AuthVariables } from './auth/types';

type Bindings = Env & AuthBindings;

export type AppEnv = { Bindings: Bindings; Variables: AuthVariables };
