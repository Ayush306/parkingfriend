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

const seedNotifications = notificationsData as unknown as NotificationItem[];

/** Reads notifications from storage, seeded from JSON. */
async function readAll(): Promise<NotificationItem[]> {
  return readPersisted<NotificationItem[]>(
    STORAGE_KEYS.notifications,
    seedNotifications
  );
}

/** Returns all notifications. */
async function list(): Promise<NotificationItem[]> {
  await delay(randomLatency());
  return readAll();
}

/** Number of currently unread notifications. */
async function unreadCount(): Promise<number> {
  const all = await readAll();
  return all.filter((n) => !n.read).length;
}

/** Marks all notifications as read and persists the state. */
async function markAllRead(): Promise<NotificationItem[]> {
  await delay(randomLatency());
  const all = await readAll();
  const next = all.map((n) => ({ ...n, read: true }));
  await writePersisted(STORAGE_KEYS.notifications, next);
  return clone(next);
}

/** Marks a single notification as read and persists the state. */
async function markRead(id: string): Promise<NotificationItem[]> {
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
