// ESLint flat config（型情報あり）。
//
// 型情報を使うルールを入れるのが目的。特に no-floating-promises は、
// Workers で追跡されない Promise のエラーがレスポンス返却後に消える問題を検出する。
// 規約の根拠は .agents/rules/code-design.md / typescript.md / error-handling.md。
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.wrangler/**',
      'worker-configuration.d.ts',
      'eslint.config.mjs',
    ],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // typescript.md「any は使わない。unknown で受けて型ガードで絞り込む」
      '@typescript-eslint/no-explicit-any': 'error',
      // code-design.md「as と ! の併用禁止」
      '@typescript-eslint/no-non-null-assertion': 'error',
      // typescript.md「union で分岐するときは never で網羅を検査する」
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      // error-handling.md「catch の中でログも throw もしない箇所を作らない」
      'no-empty': ['error', { allowEmptyCatch: false }],
      // code-design.md「ネストは3段まで」「引数は4つまで」
      'max-depth': ['warn', 3],
      'max-params': ['warn', 4],
    },
  },
);
