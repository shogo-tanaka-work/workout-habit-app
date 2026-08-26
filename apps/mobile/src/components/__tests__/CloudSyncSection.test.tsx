import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import type { SyncSettings } from '../../types/domain';
import { formatDateTime } from '../../utils/datetime';
import { CloudSyncSection } from '../CloudSyncSection';

const lastBackupAt = '2026-08-27T10:00:00.000Z';

const syncSettings: SyncSettings = {
  apiUrl: 'https://example.test',
  lastBackupAt,
  isPaused: false,
};

const renderSection = (
  overrides: Partial<React.ComponentProps<typeof CloudSyncSection>> = {},
) =>
  render(
    <CloudSyncSection
      syncSettings={syncSettings}
      pendingCount={0}
      account={null}
      isGoogleSignInAvailable
      onSaveConnection={jest.fn().mockResolvedValue(undefined)}
      onSignIn={jest.fn().mockResolvedValue(undefined)}
      onSignOut={jest.fn().mockResolvedValue(undefined)}
      onSyncNow={jest.fn().mockResolvedValue(undefined)}
      onImportPlans={jest.fn().mockResolvedValue(undefined)}
      onTogglePaused={jest.fn().mockResolvedValue(undefined)}
      onRestore={jest.fn().mockResolvedValue(undefined)}
      {...overrides}
    />,
  );

describe('状態の表示', () => {
  it('未送信があれば件数を出す', () => {
    renderSection({ pendingCount: 3 });
    expect(screen.getByText('未送信 3件')).toBeTruthy();
  });

  it('未送信が無ければ最終同期を出す', () => {
    renderSection();
    // 表示は端末のタイムゾーンで整形されるので、同じ関数で期待値を作る。
    expect(screen.getByText(`最終 ${formatDateTime(lastBackupAt)}`)).toBeTruthy();
  });

  it('一度も同期していなければ — を出す', () => {
    renderSection({ syncSettings: { ...syncSettings, lastBackupAt: null } });
    expect(screen.getByText('最終 —')).toBeTruthy();
  });

  it('自動送信を止めていると、記録は端末に溜まると伝える', () => {
    renderSection({ syncSettings: { ...syncSettings, isPaused: true } });
    expect(
      screen.getByText('停止中。記録は端末に溜まり、再開すると送られます。'),
    ).toBeTruthy();
  });
});

describe('アカウント', () => {
  it('未ログインならログインを促す', () => {
    renderSection();
    expect(screen.getByText('ログインしていません')).toBeTruthy();
    expect(screen.getByText('Google でログイン')).toBeTruthy();
  });

  it('ログイン済みならメールとログアウトを出す', () => {
    renderSection({ account: { email: 'user@example.test', displayName: 'User' } });
    expect(screen.getByText('user@example.test')).toBeTruthy();
    expect(screen.getByText('ログアウト')).toBeTruthy();
  });

  it('サインインを設定していない端末では理由を出す', () => {
    renderSection({ isGoogleSignInAvailable: false });
    expect(
      screen.getByText(
        'この端末ではGoogleサインインを設定していません（クライアントIDが未設定）。',
      ),
    ).toBeTruthy();
  });
});

describe('操作', () => {
  it('入力した接続先を保存する', async () => {
    const onSaveConnection = jest.fn().mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    renderSection({ onSaveConnection });

    fireEvent.changeText(
      screen.getByPlaceholderText('https://workout-habit-api.example.workers.dev'),
      'https://changed.test',
    );
    fireEvent.press(screen.getByText('接続先を保存'));

    await waitFor(() => expect(onSaveConnection).toHaveBeenCalledWith('https://changed.test'));
    alertSpy.mockRestore();
  });

  it('自動送信のスイッチは停止の真偽を反転して渡す', () => {
    const onTogglePaused = jest.fn().mockResolvedValue(undefined);
    renderSection({ onTogglePaused });

    fireEvent(screen.getByRole('switch'), 'valueChange', false);

    expect(onTogglePaused).toHaveBeenCalledWith(true);
  });

  it('失敗したら理由を出す', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    renderSection({ onSyncNow: jest.fn().mockRejectedValue(new Error('通信に失敗')) });

    fireEvent.press(screen.getByText('今すぐ同期'));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('同期に失敗しました', '通信に失敗'),
    );
    alertSpy.mockRestore();
  });

  it('予定の取り込みは端末の記録に触れない操作として分けている', async () => {
    const onImportPlans = jest.fn().mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    renderSection({ onImportPlans });

    fireEvent.press(screen.getByText('予定を取り込む'));

    await waitFor(() => expect(onImportPlans).toHaveBeenCalledTimes(1));
    alertSpy.mockRestore();
  });
});

describe('サーバから取り込む', () => {
  it('送信待ちが失われることを伝えてから実行する', () => {
    const onRestore = jest.fn().mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    renderSection({ onRestore });

    fireEvent.press(screen.getByText('サーバから取り込む'));

    expect(alertSpy).toHaveBeenCalledWith(
      'サーバの内容で作り直す',
      'この端末のデータをサーバの内容で置き換えます。送信待ちの記録は失われます。',
      expect.any(Array),
    );
    expect(onRestore).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('確認で選ぶと取り込む', async () => {
    const onRestore = jest.fn().mockResolvedValue(undefined);
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        buttons?.find((button) => button.text === '作り直す')?.onPress?.();
      });
    renderSection({ onRestore });

    fireEvent.press(screen.getByText('サーバから取り込む'));

    await waitFor(() => expect(onRestore).toHaveBeenCalledTimes(1));
    alertSpy.mockRestore();
  });
});
