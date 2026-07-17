import type { NotificationItem } from "@/models/types";
import {
  clone,
  readPersisted,
  writePersisted,
  STORAGE_KEYS,
} from "@/services/mockClient";

/**
 * The REAL in-app notification feed — actual things that happened to this
 * user (a new booking request, the host accepting/declining, …), written by
 * the notification watcher the moment it spots them. Stored on-device,
 * newest first, capped so it can't grow forever.
 *
 * Item ids are prefixed so a tap knows where to navigate:
 *   evt_req_*  → a new incoming request  → Booking requests screen
 *   evt_bk_*   → your booking changed    → Bookings tab
 */

const MAX_EVENTS = 60;

export interface FeedEvent {
  id: string;
  title: string;
  message: string;
  type: NotificationItem["type"];
  icon: string;
  /** epoch ms when the event was recorded (rendered as a relative time). */
  at: number;
  read: boolean;
}

/**
 * All mutations run through this queue, one at a time. The watcher's add()
 * and the screen's markRead/markAllRead are read-modify-write on the same
 * stored list — without serialization a sweep landing mid-markAll could drop
 * an event or resurrect read state.
 */
let writeQueue: Promise<unknown> = Promise.resolve();
function serialized<T>(op: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(op, op);
  writeQueue = next.catch(() => {});
  return next;
}

async function readAll(): Promise<FeedEvent[]> {
  return readPersisted<FeedEvent[]>(STORAGE_KEYS.events, []);
}

/** "Just now / 5 min ago / 2 hours ago / Yesterday / 12 Jul" */
function relativeTime(at: number): string {
  const diff = Date.now() - at;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  const d = new Date(at);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Adds one event to the top of the feed (deduped by id). */
function add(event: Omit<FeedEvent, "at" | "read">): Promise<void> {
  return serialized(async () => {
    const all = await readAll();
    if (all.some((e) => e.id === event.id)) return;
    const next = [{ ...event, at: Date.now(), read: false }, ...all].slice(0, MAX_EVENTS);
    await writePersisted(STORAGE_KEYS.events, next);
  });
}

/** The feed as displayable NotificationItems, newest first. */
async function list(): Promise<NotificationItem[]> {
  const all = await readAll();
  return all.map((e) => ({
    id: e.id,
    title: e.title,
    message: e.message,
    time: relativeTime(e.at),
    type: e.type,
    read: e.read,
    icon: e.icon,
  }));
}

async function unreadCount(): Promise<number> {
  const all = await readAll();
  return all.filter((e) => !e.read).length;
}

function markRead(id: string): Promise<void> {
  return serialized(async () => {
    const all = await readAll();
    await writePersisted(
      STORAGE_KEYS.events,
      all.map((e) => (e.id === id ? { ...e, read: true } : e))
    );
  });
}

function markAllRead(): Promise<void> {
  return serialized(async () => {
    const all = await readAll();
    await writePersisted(
      STORAGE_KEYS.events,
      all.map((e) => ({ ...e, read: true }))
    );
  });
}

function clear(): Promise<void> {
  return serialized(() => writePersisted(STORAGE_KEYS.events, []));
}

export const eventFeedService = {
  add,
  list,
  unreadCount,
  markRead,
  markAllRead,
  clear,
  clone,
};
