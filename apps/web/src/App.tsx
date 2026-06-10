import { useCallback, useState } from 'react';

import { clearToken, loadToken, saveToken } from './api';
import { ApiContext } from './hooks/useApiData';
import { BodyLogSection } from './sections/BodyLogSection';
import { BodyPartSection } from './sections/BodyPartSection';
import { ContinuitySection } from './sections/ContinuitySection';
import { ExerciseSection } from './sections/ExerciseSection';
import { TrendSection } from './sections/TrendSection';

// トークン設定 → ApiContext 提供 → 各セクション描画、の薄いシェル。
// データ取得・集計は各セクションが /analytics API に対して行う。

const App = () => {
  const [token, setToken] = useState(loadToken);
  const [tokenInput, setTokenInput] = useState('');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  // 再読込時にセクションを作り直して全フックに再取得させる。
  const [reloadCount, setReloadCount] = useState(0);

  const handleUnauthorized = useCallback(() => {
    clearToken();
    setToken('');
    setAuthMessage('トークンが無効です。再設定してください。');
  }, []);

  const handleTokenSubmit = (): void => {
    const trimmedToken = tokenInput.trim();
    if (!trimmedToken) {
      return;
    }
    saveToken(trimmedToken);
    setTokenInput('');
    setAuthMessage(null);
    setToken(trimmedToken);
  };

  const handleSignOut = (): void => {
    clearToken();
    setToken('');
    setAuthMessage(null);
  };

  if (!token) {
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
          {authMessage ? <p className="error-text">{authMessage}</p> : null}
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
    <ApiContext.Provider value={{ token, onUnauthorized: handleUnauthorized }}>
      <main className="app">
        <header className="app-header">
          <h1 className="app-title">WORKOUT HABIT</h1>
          <div className="app-header-actions">
            <button
              type="button"
              className="button-ghost"
              onClick={() => setReloadCount((count) => count + 1)}
            >
              再読込
            </button>
            <button type="button" className="button-ghost" onClick={handleSignOut}>
              トークン再設定
            </button>
          </div>
        </header>
        <div key={reloadCount}>
          <ContinuitySection />
          <TrendSection />
          <BodyPartSection />
          <ExerciseSection />
          <BodyLogSection />
        </div>
        <footer className="app-footer">
          データはアプリから「クラウドへバックアップ」された時点の内容です。
        </footer>
      </main>
    </ApiContext.Provider>
  );
};

export default App;
