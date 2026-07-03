import { useCallback, useEffect, useRef, useState } from "react";

export interface UseAsyncResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Re-runs the async function. */
  refetch: () => void;
  /** Locally overrides the current data (e.g. after an optimistic update). */
  setData: (updater: T | ((prev: T | null) => T)) => void;
}

/**
 * Runs an async function and tracks its loading/error/data state.
 * Re-runs whenever `deps` change and exposes a `refetch` for manual reloads.
 * Guards against setting state after unmount and ignores stale responses.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: React.DependencyList = []
): UseAsyncResult<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const callIdRef = useRef(0);

  // Keep the latest fn in a ref so `run` can stay stable across renders
  // while `deps` remain the trigger for re-fetching.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    const currentCall = ++callIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      if (mountedRef.current && currentCall === callIdRef.current) {
        setDataState(result);
      }
    } catch (e: unknown) {
      if (mountedRef.current && currentCall === callIdRef.current) {
        const message =
          e instanceof Error ? e.message : "Something went wrong. Please try again.";
        setError(message);
      }
    } finally {
      if (mountedRef.current && currentCall === callIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    run();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater: T | ((prev: T | null) => T)) => {
    setDataState((prev) =>
      typeof updater === "function"
        ? (updater as (p: T | null) => T)(prev)
        : updater
    );
  }, []);

  return { data, loading, error, refetch: run, setData };
}
