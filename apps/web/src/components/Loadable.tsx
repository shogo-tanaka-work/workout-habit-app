import type { ReactNode } from 'react';

import type { ApiDataState } from '../hooks/useApiData';

// useApiData の読み込み中・エラー・取得済みを出し分ける共通ラッパー。

type LoadableProps<Response> = {
  state: ApiDataState<Response>;
  children: (data: Response) => ReactNode;
};

export const Loadable = <Response,>({ state, children }: LoadableProps<Response>) => {
  if (state.errorMessage) {
    return (
      <div className="section-status">
        <p className="error-text">{state.errorMessage}</p>
        <button type="button" className="button-ghost" onClick={state.reload}>
          再試行
        </button>
      </div>
    );
  }
  if (state.isLoading || state.data === null) {
    return <p className="status-text">読み込み中…</p>;
  }
  return <>{children(state.data)}</>;
};
