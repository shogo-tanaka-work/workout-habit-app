import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { apiGet, UnauthorizedError } from '../api';

// トークンと 401 時のハンドリングを App から各セクションへ配る Context と、
// /analytics をパス単位で取得する汎用フック。

type ApiContextValue = {
  token: string;
  onUnauthorized: () => void;
};

export const ApiContext = createContext<ApiContextValue>({
  token: '',
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
  const { token, onUnauthorized } = useContext(ApiContext);
  const [data, setData] = useState<Response | null>(null);
  const [isLoading, setIsLoading] = useState(path !== null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (path === null || !token) {
      return;
    }
    let isStale = false;
    setIsLoading(true);
    setErrorMessage(null);
    apiGet<Response>(path, token)
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
  }, [path, token, reloadCount, onUnauthorized]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  return { data, isLoading, errorMessage, reload };
};
