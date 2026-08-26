// ネイティブ実装が要るモジュールの差し替え。
// 実機の挙動は自動テストの対象外で、ここでは「呼ばれたか」だけを見る。
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({
    seekTo: jest.fn().mockResolvedValue(undefined),
    play: jest.fn(),
  }),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  setNotificationHandler: jest.fn(),
  AndroidImportance: { HIGH: 4 },
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
}));
