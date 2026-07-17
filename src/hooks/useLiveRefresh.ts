import { useCallback, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

/**
 * Keeps a focused screen's data fresh — the calm, battery-friendly way:
 *  - refreshes once the moment the screen gains focus,
 *  - while focused AND the app is in the foreground, refreshes every
 *    `intervalMs` (pass a SILENT refetch so there's no loading flicker),
 *  - pauses completely when the app is backgrounded — no polling in your
 *    pocket, no waking a sleeping server — and refreshes again on return.
 *
 * Pass intervalMs = 0 for a focus-only refresh with no polling at all.
 *
 * Note: this is the interim bridge. The production-grade path is a server
 * push (Expo Notifications / FCM) that tells the host the instant a request
 * arrives, removing polling entirely — see notes in the request flow.
 */
export function useLiveRefresh(refresh: () => void, intervalMs = 30000): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setInterval> | null = null;

      const startPolling = () => {
        if (timer == null && intervalMs > 0) {
          timer = setInterval(() => refreshRef.current(), intervalMs);
        }
      };
      const stopPolling = () => {
        if (timer != null) {
          clearInterval(timer);
          timer = null;
        }
      };

      // Fresh data the instant the screen opens.
      refreshRef.current();
      // "unknown"/null (cold start) counts as foreground.
      if (AppState.currentState !== "background" && AppState.currentState !== "inactive") startPolling();

      // Poll only while the app is actually in front of the user.
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          refreshRef.current();
          startPolling();
        } else {
          stopPolling();
        }
      });

      return () => {
        stopPolling();
        sub.remove();
      };
    }, [intervalMs])
  );
}
