import { useCallback, useEffect, useRef, useState } from "react";

export interface UseAsyncResult<T> {
  data: T | null;
  loading: boolean;
  /**
   * True while a SILENT background refresh is in flight (focus/interval
   * polls). Lets screens show a subtle "updating…" hint on tab switches
   * without the full loading skeleton.
   */
  refreshing: boolean;
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
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const silentInFlightRef = useRef(0);

  const mountedRef = useRef(true);
  // Bumped by EVERY run (silent + non-silent): the freshest response wins the
  // right to write `data`, so a slow earlier call can't overwrite newer data.
  const callIdRef = useRef(0);
  // Bumped ONLY by non-silent runs: owns the loading/error lifecycle. A silent
  // background refetch must never touch this, otherwise a poll firing mid-load
  // would strand `loading` at true forever (the shimmer-stuck bug).
  const loadIdRef = useRef(0);

  // Keep the latest fn in a ref so `run` can stay stable across renders
  // while `deps` remain the trigger for re-fetching.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (silent = false) => {
    const currentCall = ++callIdRef.current;
    // Only a visible (non-silent) run owns loading; capture its id so a later
    // silent poll can't stop this run from clearing loading when it finishes.
    const currentLoad = silent ? loadIdRef.current : ++loadIdRef.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    } else {
      silentInFlightRef.current += 1;
      setRefreshing(true);
    }
    try {
      const result = await fnRef.current();
      if (mountedRef.current && currentCall === callIdRef.current) {
        setDataState(result);
      }
    } catch (e: unknown) {
      // A silent (background) failure is swallowed — the last good data stays
      // on screen instead of flashing an error during a routine poll.
      if (mountedRef.current && !silent && currentLoad === loadIdRef.current) {
        const message =
          e instanceof Error ? e.message : "Something went wrong. Please try again.";
        setError(message);
      }
    } finally {
      // Clear loading as long as no NEWER visible run has taken over — a silent
      // poll bumping callIdRef must not prevent this.
      if (mountedRef.current && !silent && currentLoad === loadIdRef.current) {
        setLoading(false);
      }
      if (silent) {
        silentInFlightRef.current = Math.max(0, silentInFlightRef.current - 1);
        if (mountedRef.current && silentInFlightRef.current === 0) {
          setRefreshing(false);
        }
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
    // A local write is the freshest truth. Invalidate any in-flight run so a
    // slow poll that STARTED before this write can't resolve later and clobber
    // it (e.g. an accepted card flipping back to Pending). loadIdRef is left
    // alone, so a visible refetch still owns the loading/error lifecycle.
    callIdRef.current += 1;
    setDataState((prev) =>
      typeof updater === "function"
        ? (updater as (p: T | null) => T)(prev)
        : updater
    );
  }, []);

  return { data, loading, refreshing, error, refetch, refetchSilent, setData };
}
