// ESLint flat config — https://docs.expo.dev/guides/using-eslint/
//
// expo の既定に加えて typescript-eslint の型情報付きルールを重ねる。
// 型情報が要るルール（no-floating-promises など）は expo config に含まれておらず、
// 「Promise を必ず追跡する」といった規約を機械で検査できていなかった。
// 規約の根拠は .agents/rules/code-design.md / typescript.md / error-handling.md。
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');
const tseslint = require('typescript-eslint');

module.exports = defineConfig([
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'ios/*', 'android/*', 'eslint.config.js'],
  },
  expoConfig,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
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
  // 設定ファイル（.js）は tsconfig に含まれないため、型情報を要するルールを外す。
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  // config plugin は Expo の prebuild（Node）が読むビルド時のコードで、アプリのバンドルには入らない。
  // CommonJS で書く必要があるため require を許す。
  {
    files: ['plugins/**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // Prettier と競合する整形系ルールを無効化（整形は prettier に一任）
  eslintConfigPrettier,
]);
