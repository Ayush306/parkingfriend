import { useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";

/**
 * Keeps a screen's data live:
 *  - refetches every time the screen gains focus (returning to a tab), and
 *  - while focused, polls every `intervalMs` so changes made by the other
 *    side (a new request, an acceptance) appear without any manual action.
 * Pass intervalMs = 0 for focus-refresh only, no polling.
 */
export function useLiveRefresh(refetch: () => void, intervalMs = 15000): void {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useFocusEffect(
    useCallback(() => {
      refetchRef.current();
      if (intervalMs <= 0) return undefined;
      const id = setInterval(() => refetchRef.current(), intervalMs);
      return () => clearInterval(id);
    }, [intervalMs])
  );
}
