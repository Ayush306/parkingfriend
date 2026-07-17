import type { Booking, ChatMessage, ChatSummary, ChatThread } from "@/models/types";
import { isApiEnabled } from "@/config/apiConfig";
import { apiChat } from "@/services/api/apiServices";
import { authService } from "@/services/authService";
import {
  delay,
  genId,
  randomLatency,
  readPersisted,
  writePersisted,
  STORAGE_KEYS,
} from "@/services/mockClient";

/**
 * Chat between the driver and the host of one booking.
 *
 * Available for the WHOLE parking lifespan — from the moment the request is
 * sent (before the host accepts; unlike the phone number, chat needs no
 * unlock) until the parking completes or the request dies. After that the
 * server closes the chat and deletes its messages.
 *
 * Demo mode mirrors the same rules on-device (single-phone role play).
 */

interface DemoChats {
  [bookingId: string]: ChatMessage[];
}

/** Demo parity with the server's isChatOpen. */
function isOpenLocally(b: Booking | null): boolean {
  if (!b) return false;
  if (b.status === "pending") return true;
  if (b.status !== "confirmed" && b.status !== "active") return false;
  // Day-based: closed once every parking day has passed.
  const days = Math.max(1, Math.ceil((Number(b.durationHours) || 0) / 24));
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayYmd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const ms = Date.parse(`${todayYmd}T00:00:00Z`) - Date.parse(`${String(b.date)}T00:00:00Z`);
  if (!Number.isFinite(ms)) return true;
  return Math.floor(ms / 86400000) < days;
}

async function getThread(bookingId: string): Promise<ChatThread> {
  if (isApiEnabled()) return apiChat.getThread(bookingId);
  await delay(randomLatency());
  const bookings = await readPersisted<Booking[]>(STORAGE_KEYS.bookings, []);
  const booking = bookings.find((b) => b.id === bookingId) ?? null;
  const open = isOpenLocally(booking);
  const chats = await readPersisted<DemoChats>(STORAGE_KEYS.chats, {});
  if (!open && chats[bookingId]) {
    // Vanish: the parking ended, wipe the conversation.
    delete chats[bookingId];
    await writePersisted(STORAGE_KEYS.chats, chats);
  }
  return {
    open,
    with: {
      name: booking?.spot?.host?.name ?? "Host",
      avatar: booking?.spot?.host?.avatar ?? null,
    },
    messages: open ? chats[bookingId] ?? [] : [],
  };
}

async function send(bookingId: string, text: string): Promise<ChatMessage> {
  const trimmed = text.trim().slice(0, 500);
  if (!trimmed) throw new Error("Type a message first.");
  if (isApiEnabled()) return apiChat.send(bookingId, trimmed);
  await delay(randomLatency());
  const bookings = await readPersisted<Booking[]>(STORAGE_KEYS.bookings, []);
  const booking = bookings.find((b) => b.id === bookingId) ?? null;
  if (!isOpenLocally(booking)) {
    throw new Error("This chat has closed — the parking has ended.");
  }
  const session = await authService.getSession().catch(() => null);
  const message: ChatMessage = {
    id: genId("msg"),
    bookingId,
    senderId: session?.id ?? "u1",
    text: trimmed,
    at: new Date().toISOString(),
  };
  const chats = await readPersisted<DemoChats>(STORAGE_KEYS.chats, {});
  chats[bookingId] = [...(chats[bookingId] ?? []), message];
  await writePersisted(STORAGE_KEYS.chats, chats);
  return message;
}

/**
 * All live chats with their last message — the notification watcher polls
 * this. Demo mode returns none: you'd only be chatting with yourself there.
 */
async function summary(): Promise<ChatSummary[]> {
  if (isApiEnabled()) return apiChat.summary();
  return [];
}

export const chatService = { getThread, send, summary };
