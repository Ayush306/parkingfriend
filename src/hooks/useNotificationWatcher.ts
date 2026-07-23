import { useEffect } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { hostService } from "@/services/hostService";
import { bookingService } from "@/services/bookingService";
import { chatService } from "@/services/chatService";
import { authService } from "@/services/authService";
import { activeChat } from "@/services/activeChat";
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

/** Polling cadence when polling is the ONLY delivery channel. */
const POLL_MS = 30000;
/**
 * Cadence once SERVER PUSH is active: the server notifies the phone directly
 * the instant something happens, so polling drops to a rare safety-net sweep
 * (~12x fewer requests) that only reconciles the in-app feed.
 */
const POLL_MS_PUSH_ACTIVE = 6 * 60 * 1000;
/** More OS pop-ups than this per sweep collapse into one summary. */
const MAX_INDIVIDUAL_POPUPS = 3;

/** True once this device registered for server push (set by the hook). */
let pushDeliveryActive = false;

interface SeenBookings {
  /** bookingId → last seen status */
  [bookingId: string]: string;
}

async function sweep(isAlive: () => boolean = () => true): Promise<void> {
  const [requests, bookings, chats] = await Promise.all([
    hostService.getRequests().catch(() => null),
    bookingService.list().catch(() => null),
    chatService.summary().catch(() => null),
  ]);
  // The hook unmounted (e.g. logout wiped the snapshots) while we were
  // fetching — writing now would resurrect the previous account's state.
  if (!isAlive()) return;

  type Popup = { title: string; body: string; data: Parameters<typeof pushService.notify>[2] };
  const popups: Popup[] = [];

  /* ── HOST: new incoming requests + drivers withdrawing ── */
  if (requests) {
    // null = this stream has never been swept (fresh install / new login):
    // seed silently. Each stream tracks its own first run, so one stream's
    // failed fetch can never trick the other into a notification storm.
    // Stored as a map id → last-seen status so STATUS CHANGES (a driver
    // cancelling) notify too. Older installs stored a plain id array —
    // migrate it silently ("seen" = status unknown).
    const rawSeen = await readPersisted<Record<string, string> | string[] | null>(
      STORAGE_KEYS.seenRequests,
      null
    );
    const firstRun = rawSeen === null;
    // Old-format migration: adopt each id's CURRENT server status, so the
    // migration sweep itself can never fire a stale transition notification.
    const currentStatus = new Map(requests.map((r) => [r.id, r.status] as const));
    const prevStatus: Record<string, string> = Array.isArray(rawSeen)
      ? Object.fromEntries(rawSeen.map((id) => [id, currentStatus.get(id) ?? "seen"]))
      : rawSeen ?? {};

    if (!firstRun) {
      for (const r of requests) {
        const was = prevStatus[r.id];

        // Brand-new pending request → "someone wants to park".
        if (was === undefined && r.status === "pending") {
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

        // The DRIVER withdrew (pending or already-accepted) → tell the host.
        // "declined" transitions are the host's own action — those stay
        // silent. So does cancelledBy "host": the HOST cancelled that
        // booking themselves; echoing "driver cancelled" would be wrong.
        if (
          was !== undefined &&
          was !== "cancelled" &&
          r.status === "cancelled" &&
          r.cancelledBy !== "host"
        ) {
          await eventFeedService.add({
            id: `evt_req_${r.id}_cancelled`,
            title: "Driver cancelled",
            message: `${r.requesterName} cancelled their parking at ${r.spotTitle}${r.date ? ` (${formatDate(r.date)})` : ""}. The slot is free again.`,
            type: "host",
            icon: "close-circle",
          });
          popups.push({
            title: "Driver cancelled",
            body: `${r.requesterName} won't be parking at ${r.spotTitle}. The slot is free again.`,
            data: { type: "host_request", filter: "All" },
          });
        }
      }
    }

    // Persist current statuses (plus recently-vanished ids, capped).
    const nextStatus: Record<string, string> = {};
    for (const r of requests) nextStatus[r.id] = r.status;
    for (const [id, st] of Object.entries(prevStatus)) {
      if (nextStatus[id] === undefined && Object.keys(nextStatus).length < 1000) {
        nextStatus[id] = st;
      }
    }
    await writePersisted(STORAGE_KEYS.seenRequests, nextStatus);
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
        // The driver's OWN cancel stays silent (no echo of their own action).
        // cancelledBy is authoritative; legacy rows fall back to "a reason
        // means the driver cancelled" (only drivers recorded reasons before).
        const ownCancel =
          b.cancelledBy === "driver" || (!b.cancelledBy && !!b.cancelReason);

        // → confirmed: the host said yes. `was === undefined` covers a booking
        // first observed AFTER the accept (the driver pocketed the phone before
        // the next sweep persisted "pending") — the event must still fire, once.
        if (b.status === "confirmed" && (was === "pending" || was === undefined)) {
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
            data: { type: "booking_update", bookingId: b.id, tab: "Accepted" },
          });
        }

        // → cancelled, and NOT the driver's own withdrawal. Route on WHO
        // cancelled, not on the prior snapshot: a plain decline leaves
        // cancelledBy null; a host cancel (or listing removal) sets "host".
        // Keying on cancelledBy (not `was`) means a booking first seen after
        // the cancel — was === undefined — still notifies, with the right
        // wording, exactly once (feed ids are deduped).
        if (b.status === "cancelled" && !ownCancel) {
          const hostCancel = b.cancelledBy === "host";
          if (hostCancel) {
            await eventFeedService.add({
              id: `evt_bk_${b.id}_cancelled`,
              title: "Booking cancelled",
              message: `The host cancelled your parking at ${spotTitle}. Find another spot nearby.`,
              type: "booking",
              icon: "alert-circle",
            });
            popups.push({
              title: "Booking cancelled",
              body: `The host cancelled your parking at ${spotTitle}. Tap to find another spot.`,
              data: { type: "booking_update", bookingId: b.id, tab: "Past" },
            });
          } else {
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
              data: { type: "booking_update", bookingId: b.id, tab: "Past" },
            });
          }
        }
      }
    }
    await writePersisted(STORAGE_KEYS.seenBookings, next);
  }

  /* ── CHAT: a new message from the other person ── */
  const session = chats ? await authService.getSession().catch(() => null) : null;
  // No session id = we can't tell whose messages these are. Skip the whole
  // block WITHOUT persisting, so the messages notify on the next sweep
  // instead of being silently marked seen.
  if (chats && session?.id) {
    const myId = session.id;
    const rawChats = await readPersisted<Record<string, string> | null>(
      STORAGE_KEYS.seenChats,
      null
    );
    const firstRunChats = rawChats === null;
    const prevAt = rawChats ?? {};
    const nextAt: Record<string, string> = {};

    for (const c of chats) {
      nextAt[c.bookingId] = c.lastAt;
      if (firstRunChats) continue;
      if (c.lastFrom === myId) continue; // my own message
      const seenAt = prevAt[c.bookingId];
      if (seenAt !== undefined && c.lastAt <= seenAt) continue; // nothing new
      // The user is reading this exact conversation right now — no popup,
      // but DO record it as seen so it never fires later either.
      if (activeChat.bookingId === c.bookingId) continue;

      const preview = c.lastText.length > 80 ? `${c.lastText.slice(0, 77)}…` : c.lastText;
      await eventFeedService.add({
        id: `evt_msg_${c.bookingId}_${c.lastAt}`,
        title: `💬 ${c.lastFromName}`,
        message: `${preview} · ${c.spotTitle}`,
        type: "booking",
        icon: "chatbubble-ellipses",
      });
      popups.push({
        title: `💬 ${c.lastFromName}`,
        body: `${preview} · ${c.spotTitle}`,
        data: { type: "chat", bookingId: c.bookingId, spotTitle: c.spotTitle },
      });
    }
    await writePersisted(STORAGE_KEYS.seenChats, nextAt);
  }

  /* ── fire the phone-panel notifications (with a storm guard) ── */
  // Demo mode is one person role-playing both sides on one device — a popup
  // would just echo their own action back at them. Feed entries still record
  // everything; only the OS pop-ups are suppressed.
  if (!isApiEnabled()) return;
  // Server push already showed these on the phone's panel — the sweep's job
  // is only to reconcile the in-app feed. No duplicate local pop-ups.
  if (pushDeliveryActive) return;
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
    let pollMs = POLL_MS;

    const tick = async () => {
      if (running || disposed) return; // never overlap sweeps
      running = true;
      try {
        await sweep(() => !disposed);
      } catch {
        // A failed sweep just waits for the next one.
      } finally {
        running = false;
      }
    };

    const start = () => {
      if (timer == null) timer = setInterval(tick, pollMs);
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };

    void pushService.setup(); // ask permission early, once
    void tick();

    // PRODUCTION channel: register for server push. Once active, the server
    // notifies this phone directly and polling backs off to a rare
    // reconciliation sweep — this is how the big apps do it.
    void pushService.registerForPush().then(async (registered) => {
      if (disposed) return;
      // If registration failed THIS launch but the server still holds this
      // device's token from a previous successful launch, it will keep pushing
      // — so treat push as the active channel to avoid the sweep ALSO firing a
      // local pop-up for every event (a double notification).
      const active =
        registered || (await pushService.isPushRegistered().catch(() => false));
      if (disposed) return;
      pushDeliveryActive = active;
      if (active && timer != null) {
        stop();
        pollMs = POLL_MS_PUSH_ACTIVE;
        start();
      } else if (active) {
        pollMs = POLL_MS_PUSH_ACTIVE;
      }
    });

    // A push arriving while the app is open syncs the in-app feed instantly.
    const removeReceived = pushService.addReceivedListener(() => void tick());
    // "unknown"/null (cold start) counts as foreground — only an explicit
    // background/inactive state holds polling back.
    if (AppState.currentState !== "background" && AppState.currentState !== "inactive") start();

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
      removeReceived();
    };
  }, [isAuthed]);
}
