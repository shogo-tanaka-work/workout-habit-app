import { useCallback, useEffect, useState } from 'react';

import { clearToken, fetchBackup, loadToken, saveToken, UnauthorizedError } from './api';
import { toDataset } from './data/transform';
import type { Dataset } from './types/domain';
import { BodyLogSection } from './sections/BodyLogSection';
import { BodyPartSection } from './sections/BodyPartSection';
import { ContinuitySection } from './sections/ContinuitySection';
import { ExerciseSection } from './sections/ExerciseSection';
import { TrendSection } from './sections/TrendSection';

// トークン設定 → /backup 取得 → 各セクション描画、の薄いシェル。

type LoadState =
  | { phase: 'setup' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; dataset: Dataset };

const App = () => {
  const [token, setToken] = useState(loadToken);
  const [tokenInput, setTokenInput] = useState('');
  const [loadState, setLoadState] = useState<LoadState>({ phase: 'setup' });

  const reload = useCallback(async (activeToken: string): Promise<void> => {
    if (!activeToken) {
      setLoadState({ phase: 'setup' });
      return;
    }
    setLoadState({ phase: 'loading' });
    try {
      const payload = await fetchBackup(activeToken);
      setLoadState({ phase: 'ready', dataset: toDataset(payload) });
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        clearToken();
        setToken('');
        setLoadState({ phase: 'error', message: error.message });
        return;
      }
      setLoadState({
        phase: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  useEffect(() => {
    void reload(token);
  }, [token, reload]);

  const handleTokenSubmit = (): void => {
    const trimmedToken = tokenInput.trim();
    if (!trimmedToken) {
      return;
    }
    saveToken(trimmedToken);
    setTokenInput('');
    setToken(trimmedToken);
  };

  const handleSignOut = (): void => {
    clearToken();
    setToken('');
    setLoadState({ phase: 'setup' });
  };

  if (!token || loadState.phase === 'setup' || (loadState.phase === 'error' && !token)) {
    return (
      <main className="app">
        <header className="app-header">
          <h1 className="app-title">WORKOUT HABIT</h1>
        </header>
        <div className="setup">
          <p className="setup-text">
            分析ダッシュボードを表示するには API トークンを設定してください。
            トークンはこのブラウザにのみ保存されます。
          </p>
          {loadState.phase === 'error' ? <p className="error-text">{loadState.message}</p> : null}
          <div className="setup-form">
            <input
              type="password"
              className="setup-input"
              placeholder="API トークン"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleTokenSubmit();
                }
              }}
            />
            <button type="button" className="button-primary" onClick={handleTokenSubmit}>
              設定して表示
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1 className="app-title">WORKOUT HABIT</h1>
        <div className="app-header-actions">
          {loadState.phase === 'ready' ? (
            <span className="app-meta">
              最終バックアップ: {loadState.dataset.exportedAt.slice(0, 16).replace('T', ' ')}
            </span>
          ) : null}
          <button type="button" className="button-ghost" onClick={() => void reload(token)}>
            再読込
          </button>
          <button type="button" className="button-ghost" onClick={handleSignOut}>
            トークン再設定
          </button>
        </div>
      </header>

      {loadState.phase === 'loading' ? <p className="status-text">読み込み中…</p> : null}
      {loadState.phase === 'error' ? (
        <div className="setup">
          <p className="error-text">{loadState.message}</p>
          <button type="button" className="button-primary" onClick={() => void reload(token)}>
            再試行
          </button>
        </div>
      ) : null}
      {loadState.phase === 'ready' ? (
        <>
          <ContinuitySection dataset={loadState.dataset} />
          <TrendSection dataset={loadState.dataset} />
          <BodyPartSection dataset={loadState.dataset} />
          <ExerciseSection dataset={loadState.dataset} />
          <BodyLogSection dataset={loadState.dataset} />
          <footer className="app-footer">
            データはアプリの「クラウドへバックアップ」で送信された時点のスナップショットです。
          </footer>
        </>
      ) : null}
    </main>
  );
};

export default App;
