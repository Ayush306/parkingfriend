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

const seedBookings = bookingsData as unknown as Booking[];

/**
 * Requesting a spot needs only the spotId — Parkmitter keeps it minimal.
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

/** Reads all bookings from storage (seeded from JSON), newest first. */
async function readAll(): Promise<Booking[]> {
  const bookings = await readPersisted<Booking[]>(
    STORAGE_KEYS.bookings,
    seedBookings
  );
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

  const booking: Booking = {
    id: genId("bk"),
    spotId: payload.spotId,
    spot: clone(spot),
    userId: payload.userId ?? "u1",
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
    const session = await authService.getSession();
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

/** Cancels a booking by id and returns the updated booking. */
async function cancel(id: string): Promise<Booking> {
  if (isApiEnabled()) return apiBookings.cancel(id);
  await delay(randomLatency());
  const all = await readPersisted<Booking[]>(
    STORAGE_KEYS.bookings,
    seedBookings
  );
  const idx = all.findIndex((b) => b.id === id);
  if (idx === -1) {
    throw new Error("Booking not found.");
  }
  all[idx] = { ...all[idx], status: "cancelled", contactUnlocked: false };
  await writePersisted(STORAGE_KEYS.bookings, all);
  return clone(all[idx]);
}

export const bookingService = {
  create,
  list,
  getById,
  cancel,
};
