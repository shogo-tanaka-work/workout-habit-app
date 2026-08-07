import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { apiGet, UnauthorizedError } from '../api';

// セッション切れ時のハンドリングを App から各セクションへ配る Context と、
// /analytics をパス単位で取得する汎用フック。
// 認証は Cloudflare Access が担うため、画面はトークンを持たない。

type ApiContextValue = {
  onUnauthorized: () => void;
};

export const ApiContext = createContext<ApiContextValue>({
  onUnauthorized: () => undefined,
});

export type ApiDataState<Response> = {
  data: Response | null;
  isLoading: boolean;
  errorMessage: string | null;
  reload: () => void;
};

// path が null のときは取得しない（依存データ待ちのセクション用）。
export const useApiData = <Response>(path: string | null): ApiDataState<Response> => {
  const { onUnauthorized } = useContext(ApiContext);
  const [data, setData] = useState<Response | null>(null);
  const [isLoading, setIsLoading] = useState(path !== null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (path === null) {
      return;
    }
    let isStale = false;
    setIsLoading(true);
    setErrorMessage(null);
    apiGet<Response>(path)
      .then((response) => {
        if (!isStale) {
          setData(response);
        }
      })
      .catch((error: unknown) => {
        if (isStale) {
          return;
        }
        if (error instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!isStale) {
          setIsLoading(false);
        }
      });
    return () => {
      isStale = true;
    };
  }, [path, reloadCount, onUnauthorized]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  return { data, isLoading, errorMessage, reload };
};
