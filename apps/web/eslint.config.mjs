// ESLint flat config（型情報あり）。
//
// 型情報を使うルールを入れるのが目的。特に no-floating-promises は、
// await 忘れで画面が更新されないまま終わる不具合を検出する。
// 規約の根拠は .agents/rules/code-design.md / typescript.md / error-handling.md。
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'dist/**', '.wrangler/**', 'eslint.config.mjs', 'vite.config.ts'],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.worker.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      'max-depth': ['warn', 3],
      'max-params': ['warn', 4],
    },
  },
);
