// テストは jest-expo の preset で動かす（React Native のモジュール解決とトランスパイルが要るため）。
// 対象は src 配下のロジックとコンポーネント。ネイティブ実機が要る層（expo-sqlite の実 DB・
// expo-audio・通知）はテストせず、呼び出し側の分岐だけを見る。
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts?(x)'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/__tests__/**'],
};
