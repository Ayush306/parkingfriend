import { useCallback, useEffect, useRef, useState } from "react";

export interface UseAsyncResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Re-runs the async function, showing the loading state. */
  refetch: () => void;
  /**
   * Re-runs WITHOUT touching loading/error — for background polls that must
   * not flicker the UI. On success it swaps in fresh data; on failure it
   * keeps the last good data (a dropped poll shouldn't blank the screen).
   */
  refetchSilent: () => void;
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

  const run = useCallback(async (silent = false) => {
    const currentCall = ++callIdRef.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const result = await fnRef.current();
      if (mountedRef.current && currentCall === callIdRef.current) {
        setDataState(result);
      }
    } catch (e: unknown) {
      // A silent (background) failure is swallowed — the last good data stays
      // on screen instead of flashing an error during a routine poll.
      if (mountedRef.current && currentCall === callIdRef.current && !silent) {
        const message =
          e instanceof Error ? e.message : "Something went wrong. Please try again.";
        setError(message);
      }
    } finally {
      if (mountedRef.current && currentCall === callIdRef.current && !silent) {
        setLoading(false);
      }
    }
  }, []);

  const refetch = useCallback(() => run(false), [run]);
  const refetchSilent = useCallback(() => run(true), [run]);

  useEffect(() => {
    mountedRef.current = true;
    run(false);
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

  return { data, loading, error, refetch, refetchSilent, setData };
}
