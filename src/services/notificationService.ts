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
import { formatDate } from "@/utils/format";

const seedNotifications = notificationsData as unknown as NotificationItem[];

/* ── API mode ─────────────────────────────────────────────────────────
 * Real accounts get REAL notifications, not the bundled demo feed. Today
 * that means "leave a rating" reminders: one per completed parking the user
 * hasn't rated yet — as the driver (rate your host) AND as the host (rate
 * your guest). A reminder disappears by itself once the rating is left.
 * Read-state is kept on-device (ids in storage). */

const ratingNotifId = (role: string, bookingId: string) =>
  `rate_${role}_${bookingId}`;

async function readReadIds(): Promise<string[]> {
  return readPersisted<string[]>(STORAGE_KEYS.notifRead, []);
}

async function apiList(): Promise<NotificationItem[]> {
  const [pending, readIds] = await Promise.all([
    ratingService.getPending().catch(() => []),
    readReadIds(),
  ]);
  const read = new Set(readIds);
  return pending.map((p) => {
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
  return readAll();
}

/** Number of currently unread notifications. */
async function unreadCount(): Promise<number> {
  const all = await list();
  return all.filter((n) => !n.read).length;
}

/** Marks all notifications as read and persists the state. */
async function markAllRead(): Promise<NotificationItem[]> {
  if (isApiEnabled()) {
    const all = await apiList();
    await writePersisted(
      STORAGE_KEYS.notifRead,
      all.map((n) => n.id)
    );
    return all.map((n) => ({ ...n, read: true }));
  }
  await delay(randomLatency());
  const all = await readAll();
  const next = all.map((n) => ({ ...n, read: true }));
  await writePersisted(STORAGE_KEYS.notifications, next);
  return clone(next);
}

/** Marks a single notification as read and persists the state. */
async function markRead(id: string): Promise<NotificationItem[]> {
  if (isApiEnabled()) {
    const readIds = await readReadIds();
    if (!readIds.includes(id)) {
      await writePersisted(STORAGE_KEYS.notifRead, [...readIds, id]);
    }
    return apiList();
  }
  const all = await readAll();
  const next = all.map((n) => (n.id === id ? { ...n, read: true } : n));
  await writePersisted(STORAGE_KEYS.notifications, next);
  return clone(next);
}

export const notificationService = {
  list,
  unreadCount,
  markAllRead,
  markRead,
};
