import type { NotificationItem } from "@/models/types";
import notificationsData from "@/data/notifications.json";
import {
  clone,
  delay,
  randomLatency,
  readPersisted,
  STORAGE_KEYS,
  writePersisted,
} from "@/services/mockClient";
import { isApiEnabled } from "@/config/apiConfig";
import { ratingService } from "@/services/ratingService";
import { eventFeedService } from "@/services/eventFeedService";
import { formatDate } from "@/utils/format";

const seedNotifications = notificationsData as unknown as NotificationItem[];

/* ── API mode ─────────────────────────────────────────────────────────
 * Real accounts get REAL notifications, not the bundled demo feed:
 *   1. the live event feed the watcher writes (new request, accepted,
 *      declined — see useNotificationWatcher), newest first, and
 *   2. "leave a rating" reminders: one per completed parking the user
 *      hasn't rated yet, which disappear by themselves once rated.
 * Read-state is kept on-device. */

const ratingNotifId = (role: string, bookingId: string) =>
  `rate_${role}_${bookingId}`;

async function readReadIds(): Promise<string[]> {
  return readPersisted<string[]>(STORAGE_KEYS.notifRead, []);
}

async function apiList(): Promise<NotificationItem[]> {
  const [events, pending, readIds] = await Promise.all([
    eventFeedService.list().catch(() => [] as NotificationItem[]),
    ratingService.getPending().catch(() => []),
    readReadIds(),
  ]);
  const read = new Set(readIds);
  const reminders: NotificationItem[] = pending.map((p) => {
    const id = ratingNotifId(p.role, p.bookingId);
    return {
      id,
      title: p.role === "driver" ? "Rate your host ⭐" : "Rate your guest ⭐",
      message:
        p.role === "driver"
          ? `Your parking at ${p.spotTitle} is complete. How was it? Rate ${p.counterparty.name} to help other drivers.`
          : `${p.counterparty.name} parked at ${p.spotTitle}. How did it go? Your rating helps other hosts.`,
      time: `Parked on ${formatDate(p.date)}`,
      type: p.role === "driver" ? "booking" : "host",
      read: read.has(id),
      icon: "star",
    };
  });
  // Live events first (already newest-first), then the rating reminders.
  return [...events, ...reminders];
}

/* ── demo mode ──────────────────────────────────────────────────────── */

/** Reads notifications from storage, seeded from JSON. */
async function readAll(): Promise<NotificationItem[]> {
  return readPersisted<NotificationItem[]>(
    STORAGE_KEYS.notifications,
    seedNotifications
  );
}

/** Returns all notifications. */
async function list(): Promise<NotificationItem[]> {
  if (isApiEnabled()) return apiList();
  await delay(randomLatency());
  // Demo mode too shows the LIVE events the watcher recorded (role-play on
  // one device still produces real accept/decline activity) above the seed.
  const events = await eventFeedService.list().catch(() => [] as NotificationItem[]);
  return [...events, ...(await readAll())];
}

/** Number of currently unread notifications. */
async function unreadCount(): Promise<number> {
  const all = await list();
  return all.filter((n) => !n.read).length;
}

/** Marks all notifications as read and persists the state. */
async function markAllRead(): Promise<NotificationItem[]> {
  if (isApiEnabled()) {
    await eventFeedService.markAllRead().catch(() => {});
    const [all, existing] = await Promise.all([apiList(), readReadIds()]);
    // MERGE with what's already read (never replace — a failed fetch must not
    // wipe the read-state) and cap the list so it can't grow forever.
    const merged = [...new Set([...existing, ...all.map((n) => n.id)])].slice(-200);
    await writePersisted(STORAGE_KEYS.notifRead, merged);
    return all.map((n) => ({ ...n, read: true }));
  }
  await delay(randomLatency());
  await eventFeedService.markAllRead().catch(() => {});
  const all = await readAll();
  const next = all.map((n) => ({ ...n, read: true }));
  await writePersisted(STORAGE_KEYS.notifications, next);
  return list();
}

/** Marks a single notification as read and persists the state. */
async function markRead(id: string): Promise<NotificationItem[]> {
  if (isApiEnabled()) {
    if (id.startsWith("evt_")) {
      await eventFeedService.markRead(id).catch(() => {});
      return apiList();
    }
    const readIds = await readReadIds();
    if (!readIds.includes(id)) {
      await writePersisted(STORAGE_KEYS.notifRead, [...readIds, id].slice(-200));
    }
    return apiList();
  }
  if (id.startsWith("evt_")) {
    await eventFeedService.markRead(id).catch(() => {});
    return list();
  }
  const all = await readAll();
  const next = all.map((n) => (n.id === id ? { ...n, read: true } : n));
  await writePersisted(STORAGE_KEYS.notifications, next);
  return list();
}

export const notificationService = {
  list,
  unreadCount,
  markAllRead,
  markRead,
};
