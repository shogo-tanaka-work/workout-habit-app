import { useCallback, useState } from 'react';

import { ApiContext } from './hooks/useApiData';
import { BodyLogSection } from './sections/BodyLogSection';
import { BodyPartSection } from './sections/BodyPartSection';
import { ContinuitySection } from './sections/ContinuitySection';
import { ExerciseSection } from './sections/ExerciseSection';
import { TrendSection } from './sections/TrendSection';

// ApiContext 提供 → 各セクション描画、の薄いシェル。
// データ取得・集計は各セクションが /analytics API に対して行う。
//
// 認証は Cloudflare Access がこのホストの入口で済ませている。
// ここへ到達している時点でログイン済みなので、画面はログイン UI を持たない。

const App = () => {
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  // 再読込時にセクションを作り直して全フックに再取得させる。
  const [reloadCount, setReloadCount] = useState(0);

  // Access のセッションが切れた場合。再読み込みでログインし直せる。
  const handleUnauthorized = useCallback(() => {
    setAuthMessage('ログインの有効期限が切れました。ページを再読み込みしてください。');
  }, []);

  return (
    <ApiContext.Provider value={{ onUnauthorized: handleUnauthorized }}>
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
          </div>
        </header>
        {authMessage ? <p className="error-text">{authMessage}</p> : null}
        <div key={reloadCount}>
          <ContinuitySection />
          <TrendSection />
          <BodyPartSection />
          <ExerciseSection />
          <BodyLogSection />
        </div>
        <footer className="app-footer">
          記録はモバイルアプリから同期された時点の内容です。
        </footer>
      </main>
    </ApiContext.Provider>
  );
};

export default App;
