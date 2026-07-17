import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { hostService } from "@/services/hostService";
import { useAuth } from "@/context/AuthContext";

/**
 * Pending incoming-request count for the tab-bar badge. Polled gently in the
 * background so "My Space" can badge a new request even from another tab —
 * but only while the app is in the foreground (paused when backgrounded, so
 * it never runs in the user's pocket) and always silent (never a spinner).
 *
 * This lightweight count is the one thing that must stay fresh app-wide; once
 * server push (Expo/FCM) lands, the server updates the badge and this poll is
 * removed entirely.
 */
export function usePendingRequestCount(pollMs = 45000): number {
  const { isAuthed } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAuthed) {
      setCount(0);
      return undefined;
    }
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      try {
        const requests = await hostService.getRequests();
        if (alive) {
          setCount(requests.filter((r) => r.status === "pending").length);
        }
      } catch {
        // Network hiccup — keep the last known count.
      }
    };
    const start = () => {
      if (timer == null) timer = setInterval(load, pollMs);
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };

    load();
    // "unknown"/null (cold start) counts as foreground.
    if (AppState.currentState !== "background" && AppState.currentState !== "inactive") start();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        load();
        start();
      } else {
        stop();
      }
    });

    return () => {
      alive = false;
      stop();
      sub.remove();
    };
  }, [isAuthed, pollMs]);

  return count;
}
