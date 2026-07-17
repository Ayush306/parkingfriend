import { useEffect } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { hostService } from "@/services/hostService";
import { bookingService } from "@/services/bookingService";
import { pushService } from "@/services/pushService";
import { eventFeedService } from "@/services/eventFeedService";
import { isApiEnabled } from "@/config/apiConfig";
import {
  readPersisted,
  writePersisted,
  STORAGE_KEYS,
} from "@/services/mockClient";
import { formatDate } from "@/utils/format";

/**
 * Watches for things that happened to the signed-in user and turns them into
 * notifications — both a phone-panel notification (tap → the right screen)
 * and an entry in the in-app Notifications feed:
 *
 *   HOST side:   a new incoming parking request           → "New parking request"
 *   DRIVER side: your request was accepted by the host    → "Request accepted"
 *                your request was declined by the host    → "Request declined"
 *
 * It works by polling the same endpoints the screens already use and diffing
 * against a persisted "seen" snapshot, so each event notifies exactly once —
 * across app restarts too. The very first sweep after login/install seeds the
 * snapshot silently (no notification storm for pre-existing data).
 */

const POLL_MS = 30000;
/** More OS pop-ups than this per sweep collapse into one summary. */
const MAX_INDIVIDUAL_POPUPS = 3;

interface SeenBookings {
  /** bookingId → last seen status */
  [bookingId: string]: string;
}

async function sweep(): Promise<void> {
  const [requests, bookings] = await Promise.all([
    hostService.getRequests().catch(() => null),
    bookingService.list().catch(() => null),
  ]);

  type Popup = { title: string; body: string; data: Parameters<typeof pushService.notify>[2] };
  const popups: Popup[] = [];

  /* ── HOST: new incoming requests ── */
  if (requests) {
    // null = this stream has never been swept (fresh install / new login):
    // seed silently. Each stream tracks its own first run, so one stream's
    // failed fetch can never trick the other into a notification storm.
    const seenIdsRaw = await readPersisted<string[] | null>(STORAGE_KEYS.seenRequests, null);
    const firstRun = seenIdsRaw === null;
    const seenIds = seenIdsRaw ?? [];
    const seen = new Set(seenIds);
    const fresh = requests.filter((r) => !seen.has(r.id));

    if (!firstRun) {
      for (const r of fresh.filter((r) => r.status === "pending")) {
        const when = r.date ? ` for ${formatDate(r.date)}` : "";
        await eventFeedService.add({
          id: `evt_req_${r.id}`,
          title: "New parking request 🚗",
          message: `${r.requesterName} wants to park at ${r.spotTitle}${when}. Tap to accept or decline.`,
          type: "host",
          icon: "car",
        });
        popups.push({
          title: "New parking request 🚗",
          body: `${r.requesterName} wants to park at ${r.spotTitle}. Tap to respond.`,
          data: { type: "host_request" },
        });
      }
    }
    if (fresh.length > 0 || firstRun) {
      await writePersisted(
        STORAGE_KEYS.seenRequests,
        // Keep every id still present plus room for history churn.
        [...new Set([...requests.map((r) => r.id), ...seenIds])].slice(0, 1000)
      );
    }
  }

  /* ── DRIVER: my requests getting accepted / declined ── */
  if (bookings) {
    const prev = await readPersisted<SeenBookings | null>(STORAGE_KEYS.seenBookings, null);
    const next: SeenBookings = {};
    for (const b of bookings) next[b.id] = b.status;

    if (prev !== null) {
      for (const b of bookings) {
        const was = prev[b.id];
        if (was === b.status) continue;
        const spotTitle = b.spot?.title ?? "your parking";

        // pending → confirmed: the host said yes.
        if (b.status === "confirmed" && was === "pending") {
          await eventFeedService.add({
            id: `evt_bk_${b.id}_accepted`,
            title: "Request accepted 🎉",
            message: `Your parking at ${spotTitle} is confirmed. The host's number is now visible in Bookings.`,
            type: "booking",
            icon: "checkmark-circle",
          });
          popups.push({
            title: "Parking accepted 🎉",
            body: `${spotTitle} is yours — the host's number is in your Bookings.`,
            data: { type: "booking_update", bookingId: b.id },
          });
        }

        // pending → cancelled WITHOUT a driver reason = the host declined.
        // (A driver's own cancel records a cancelReason, so it stays silent.)
        if (b.status === "cancelled" && was === "pending" && !b.cancelReason) {
          await eventFeedService.add({
            id: `evt_bk_${b.id}_declined`,
            title: "Request declined",
            message: `The host couldn't take your request for ${spotTitle}. Try another spot nearby.`,
            type: "booking",
            icon: "close-circle",
          });
          popups.push({
            title: "Request declined",
            body: `${spotTitle} isn't available. Try another spot nearby.`,
            data: { type: "booking_update", bookingId: b.id },
          });
        }

        // confirmed/active → cancelled WITHOUT a driver reason: an already-
        // accepted parking fell through (e.g. the host removed the listing).
        // The driver must hear about this — they were counting on the spot.
        if (
          b.status === "cancelled" &&
          (was === "confirmed" || was === "active") &&
          !b.cancelReason
        ) {
          await eventFeedService.add({
            id: `evt_bk_${b.id}_cancelled`,
            title: "Booking cancelled",
            message: `Your confirmed parking at ${spotTitle} was cancelled by the host. Find another spot nearby.`,
            type: "booking",
            icon: "alert-circle",
          });
          popups.push({
            title: "Booking cancelled",
            body: `Your parking at ${spotTitle} was cancelled. Tap to find another spot.`,
            data: { type: "booking_update", bookingId: b.id },
          });
        }
      }
    }
    await writePersisted(STORAGE_KEYS.seenBookings, next);
  }

  /* ── fire the phone-panel notifications (with a storm guard) ── */
  // Demo mode is one person role-playing both sides on one device — a popup
  // would just echo their own action back at them. Feed entries still record
  // everything; only the OS pop-ups are suppressed.
  if (!isApiEnabled()) return;
  if (popups.length > MAX_INDIVIDUAL_POPUPS) {
    await pushService.notify(
      "ParkingFriend updates",
      `${popups.length} new booking updates — open the app to see them.`,
      { type: popups.some((p) => p.data.type === "host_request") ? "host_request" : "booking_update" }
    );
  } else {
    for (const p of popups) {
      await pushService.notify(p.title, p.body, p.data);
    }
  }
}

/** Mount once inside the signed-in area (MainTabs). */
export function useNotificationWatcher(): void {
  const { isAuthed } = useAuth();

  useEffect(() => {
    if (!isAuthed) return undefined;

    let disposed = false;
    let running = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      if (running || disposed) return; // never overlap sweeps
      running = true;
      try {
        await sweep();
      } catch {
        // A failed sweep just waits for the next one.
      } finally {
        running = false;
      }
    };

    const start = () => {
      if (timer == null) timer = setInterval(tick, POLL_MS);
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };

    void pushService.setup(); // ask permission early, once
    void tick();
    if (AppState.currentState === "active") start();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void tick();
        start();
      } else {
        stop();
      }
    });

    return () => {
      disposed = true;
      stop();
      sub.remove();
    };
  }, [isAuthed]);
}
