import type { Booking, ParkingSpot } from "@/models/types";
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

const seedBookings = bookingsData as unknown as Booking[];

export interface CreateBookingPayload {
  spotId: string;
  spot?: ParkingSpot;
  userId?: string;
  vehicleType: string;
  vehicleNumber: string;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  amount: number;
}

/** Generates a random 4-digit OTP for spot access. */
function makeOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
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

/** Creates a new confirmed booking and persists it. */
async function create(payload: CreateBookingPayload): Promise<Booking> {
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
    vehicleType: payload.vehicleType,
    vehicleNumber: payload.vehicleNumber.trim().toUpperCase(),
    date: payload.date,
    startTime: payload.startTime,
    endTime: payload.endTime,
    durationHours: payload.durationHours,
    amount: payload.amount,
    status: "confirmed",
    createdAt: new Date().toISOString(),
    contactUnlocked: true,
    otp: makeOtp(),
  };

  const existing = await readPersisted<Booking[]>(
    STORAGE_KEYS.bookings,
    seedBookings
  );
  const next = [booking, ...existing];
  await writePersisted(STORAGE_KEYS.bookings, next);
  return clone(booking);
}

/** Returns all bookings, newest first. */
async function list(): Promise<Booking[]> {
  await delay(randomLatency());
  return readAll();
}

/** Returns a single booking by id, or null. */
async function getById(id: string): Promise<Booking | null> {
  await delay(randomLatency());
  const all = await readAll();
  const match = all.find((b) => b.id === id);
  return match ? clone(match) : null;
}

/** Cancels a booking by id and returns the updated booking. */
async function cancel(id: string): Promise<Booking> {
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
