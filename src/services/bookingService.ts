import type { Booking, HostRequest, ParkingSpot } from "@/models/types";
import { authService } from "@/services/authService";
import bookingsData from "@/data/bookings.json";
import {
  clone,
  delay,
  genId,
  randomLatency,
  readPersisted,
  STORAGE_KEYS,
  writePersisted,
} from "@/services/mockClient";
import { spotService } from "@/services/spotService";
import { isApiEnabled } from "@/config/apiConfig";
import { apiBookings } from "@/services/api/apiServices";
import { isSpotOpenNow } from "@/utils/availability";

const seedBookings = bookingsData as unknown as Booking[];

/**
 * Requesting a spot needs only the spotId — ParkingFriend keeps it minimal.
 * Everything else is optional detail with sensible defaults.
 */
export interface CreateBookingPayload {
  spotId: string;
  spot?: ParkingSpot;
  userId?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  durationHours?: number;
  amount?: number;
}

/** Device-local today as YYYY-MM-DD. */
function todayYmd(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Demo parity with the server's isBookingCompleted: an accepted booking is
 * completed once EVERY parking day has fully passed.
 */
function isCompletedLocally(b: Booking): boolean {
  if (b.status !== "confirmed" && b.status !== "active") return false;
  const days = Math.max(1, Math.ceil((Number(b.durationHours) || 0) / 24));
  const ms =
    Date.parse(`${todayYmd()}T00:00:00Z`) - Date.parse(`${String(b.date)}T00:00:00Z`);
  if (!Number.isFinite(ms)) return false;
  return Math.floor(ms / 86400000) >= days;
}

/** Reads all bookings from storage (seeded from JSON), newest first. */
async function readAll(): Promise<Booking[]> {
  const bookings = await readPersisted<Booking[]>(
    STORAGE_KEYS.bookings,
    seedBookings
  );
  // Older bookings baked a random-placeholder photo into their spot snapshot;
  // strip it so the row renders the vehicle graphic instead of a stock image.
  for (const b of bookings) {
    if (b.spot && Array.isArray(b.spot.images)) {
      b.spot.images = b.spot.images.filter(
        (u) => !String(u).includes("picsum.photos")
      );
    }
    // Same "completed once the parking days passed" flag the API serves.
    b.completed = isCompletedLocally(b);
  }
  return bookings.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Sends a parking REQUEST to the host. The booking starts as "pending" with
 * the host's contact hidden; it flips to "confirmed" (phone revealed) only
 * when the host accepts — see hostService.respond, which updates the linked
 * booking via the request's bookingId.
 */
async function create(payload: CreateBookingPayload): Promise<Booking> {
  if (isApiEnabled()) return apiBookings.create(payload);
  await delay(randomLatency());

  // Resolve the spot for the booking snapshot.
  let spot = payload.spot ?? null;
  if (!spot) {
    spot = await spotService.getById(payload.spotId);
  }
  if (!spot) {
    throw new Error("This parking spot is no longer available.");
  }

  const session = await authService.getSession().catch(() => null);

  // Self-request guard (demo parity with the server): a host can never
  // request their own listing.
  if (spot.hostId && session?.id && spot.hostId === session.id) {
    throw new Error("This is your own listing — you can't request your own parking space.");
  }

  // Availability guard (demo parity with the server): a listing that's switched
  // off or outside its from→to date window takes no new requests.
  if (!isSpotOpenNow(spot)) {
    throw new Error("This parking isn't available right now — try another spot nearby.");
  }

  // Capacity guard (demo parity with the server): a full space takes no
  // new requests.
  if ((spot.remainingCount ?? spot.capacity ?? 1) <= 0) {
    throw new Error("This parking is full right now — try another spot nearby.");
  }

  const booking: Booking = {
    id: genId("bk"),
    spotId: payload.spotId,
    spot: clone(spot),
    userId: payload.userId ?? session?.id ?? "u1",
    vehicleType: payload.vehicleType ?? "car",
    vehicleNumber: (payload.vehicleNumber ?? "").trim().toUpperCase(),
    date: payload.date ?? new Date().toISOString().slice(0, 10),
    startTime: payload.startTime ?? "09:00",
    endTime: payload.endTime ?? "18:00",
    durationHours: payload.durationHours ?? 8,
    amount: payload.amount ?? spot.pricePerDay,
    status: "pending",
    createdAt: new Date().toISOString(),
    contactUnlocked: false,
    hostPhone: null,
  };

  const existing = await readPersisted<Booking[]>(
    STORAGE_KEYS.bookings,
    seedBookings
  );
  await writePersisted(STORAGE_KEYS.bookings, [booking, ...existing]);

  // Raise the linked request the host sees in Post (accept/decline there).
  try {
    const requests = await readPersisted<HostRequest[]>(
      STORAGE_KEYS.requests,
      []
    );
    const request: HostRequest = {
      id: genId("hr"),
      spotTitle: spot.title,
      requesterName: session?.name ?? "A driver",
      requesterAvatar: session?.avatar,
      requesterPhone: session?.phone ?? "",
      vehicleType: booking.vehicleType,
      date: booking.date,
      time: booking.startTime,
      status: "pending",
      bookingId: booking.id,
    };
    await writePersisted(STORAGE_KEYS.requests, [request, ...requests]);
  } catch {
    // The request card is best-effort in demo mode; the booking still exists.
  }

  return clone(booking);
}

/** Returns all bookings, newest first. */
async function list(): Promise<Booking[]> {
  if (isApiEnabled()) return apiBookings.list();
  await delay(randomLatency());
  return readAll();
}

/** Returns a single booking by id, or null. */
async function getById(id: string): Promise<Booking | null> {
  if (isApiEnabled()) return apiBookings.getById(id);
  await delay(randomLatency());
  const all = await readAll();
  const match = all.find((b) => b.id === id);
  return match ? clone(match) : null;
}

/** Cancels a booking by id (with the driver's reason) and returns it. */
async function cancel(id: string, reason?: string): Promise<Booking> {
  if (isApiEnabled()) return apiBookings.cancel(id, reason);
  await delay(randomLatency());
  const all = await readPersisted<Booking[]>(
    STORAGE_KEYS.bookings,
    seedBookings
  );
  const idx = all.findIndex((b) => b.id === id);
  if (idx === -1) {
    throw new Error("Booking not found.");
  }
  all[idx] = {
    ...all[idx],
    status: "cancelled",
    contactUnlocked: false,
    hostPhone: null,
    cancelReason: reason || undefined,
  };
  await writePersisted(STORAGE_KEYS.bookings, all);

  // Retire the linked pending host request so the host never sees a request
  // the driver already withdrew (demo parity with the server cascade).
  try {
    const requests = await readPersisted<HostRequest[]>(STORAGE_KEYS.requests, []);
    let changed = false;
    for (let i = 0; i < requests.length; i++) {
      if (requests[i].bookingId === id && requests[i].status === "pending") {
        requests[i] = { ...requests[i], status: "declined" };
        changed = true;
      }
    }
    if (changed) await writePersisted(STORAGE_KEYS.requests, requests);
  } catch {
    // Best-effort in demo mode.
  }

  return clone(all[idx]);
}

export const bookingService = {
  create,
  list,
  getById,
  cancel,
};
