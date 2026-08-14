import { useCallback, useState } from 'react';

import { ApiContext, useApiData } from './hooks/useApiData';
import { BodyLogSection } from './sections/BodyLogSection';
import { BodyPartSection } from './sections/BodyPartSection';
import { ContinuitySection } from './sections/ContinuitySection';
import { ExerciseSection } from './sections/ExerciseSection';
import { FeedbackSection } from './sections/FeedbackSection';
import { PlanSection } from './sections/PlanSection';
import { TrendSection } from './sections/TrendSection';
import { Viewer } from './components/Viewer';
import type { ExercisesResponse } from './types/api';

// ApiContext 提供 → 各セクション描画、の薄いシェル。
// データ取得・集計は各セクションが /analytics API に対して行う。
// 例外は種目一覧（/analytics/exercises）だけ。予定（種目名の解決）と種目別グラフの
// 2区画が同じ一覧を使うため、ここで一度だけ取得して props で配る。

// 認証は Cloudflare Access がこのホストの入口で済ませている。
// ここへ到達している時点でログイン済みなので、画面はログイン UI を持たない。

const App = () => {
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  // 再読込時にセクションを作り直して全フックに再取得させる。
  const [reloadCount, setReloadCount] = useState(0);
  // 種目一覧。App 自身は key で作り直されないため、再読込ボタンで明示的に reload する。
  const exercisesState = useApiData<ExercisesResponse>('/analytics/exercises');

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
            <Viewer />
            <button
              type="button"
              className="button-ghost"
              onClick={() => {
                exercisesState.reload();
                setReloadCount((count) => count + 1);
              }}
            >
              再読込
            </button>
          </div>
        </header>
        {authMessage ? <p className="error-text">{authMessage}</p> : null}
        <div key={reloadCount}>
          <ContinuitySection />
          <PlanSection exercisesState={exercisesState} />
          <FeedbackSection />
          <TrendSection />
          <BodyPartSection />
          <ExerciseSection exercisesState={exercisesState} />
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
