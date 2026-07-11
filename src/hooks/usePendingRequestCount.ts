import { useEffect, useState } from "react";
import { hostService } from "@/services/hostService";
import { useAuth } from "@/context/AuthContext";

/**
 * Number of pending incoming host requests, polled in the background so the
 * tab bar can badge "My Space" the moment a driver requests your parking —
 * even while you're on another tab.
 */
export function usePendingRequestCount(pollMs = 30000): number {
  const { isAuthed } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAuthed) {
      setCount(0);
      return undefined;
    }
    let alive = true;
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
    load();
    const id = setInterval(load, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [isAuthed, pollMs]);

  return count;
}
