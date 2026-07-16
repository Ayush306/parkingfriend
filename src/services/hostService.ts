import type { Booking, HostRequest, ParkingSpot, VehicleType } from "@/models/types";
import { authService } from "@/services/authService";
import hostListingsData from "@/data/hostListings.json";
import hostRequestsData from "@/data/hostRequests.json";
import {
  clone,
  delay,
  genId,
  randomLatency,
  readPersisted,
  STORAGE_KEYS,
  writePersisted,
} from "@/services/mockClient";
import { isApiEnabled } from "@/config/apiConfig";
import { apiHost } from "@/services/api/apiServices";
import { isWithinAvailabilityWindow } from "@/utils/availability";

const seedListings = hostListingsData as unknown as ParkingSpot[];
const seedRequests = hostRequestsData as unknown as HostRequest[];

export interface CreateListingPayload {
  title: string;
  type: ParkingSpot["type"];
  /** Mandatory — what fits in the space (car / bike / bicycle). */
  vehicleTypes: VehicleType[];
  /** Mandatory — how many vehicles fit (1–50). */
  capacity: number;
  address: string;
  area: string;
  city?: string;
  landmark: string;
  nearStation: string;
  /** Real coordinates the host chose on the map — mandatory, no fallback city. */
  latitude: number;
  longitude: number;
  pricePerHour: number;
  pricePerDay: number;
  isFree?: boolean;
  amenities?: string[];
  availableFrom: string;
  availableTo: string;
  instructions?: string;
  images?: string[];
  /** True = open every day (no calendar window). Default true. */
  availableAlways?: boolean;
  /** Window start (YYYY-MM-DD) — required when availableAlways is false. */
  availableStartDate?: string | null;
  /** Window end (YYYY-MM-DD) — required when availableAlways is false. */
  availableEndDate?: string | null;
}

/** Reads the host's listings from storage, seeded from JSON. */
async function readListings(): Promise<ParkingSpot[]> {
  const listings = await readPersisted<ParkingSpot[]>(STORAGE_KEYS.listings, seedListings);
  // Listings created before the capacity feature default to 1 empty slot;
  // legacy random-placeholder photos are stripped (vehicle graphic instead).
  return listings.map((s) => ({
    ...s,
    capacity: Math.max(1, Number(s.capacity) || 1),
    remainingCount: Math.max(
      0,
      Number(s.remainingCount ?? s.capacity ?? 1) || 0
    ),
    images: (s.images ?? []).filter((u) => !String(u).includes("picsum.photos")),
    views: Math.max(0, Number(s.views) || 0),
    // Legacy listings had no availability window — treat them as always open.
    availableAlways: s.availableAlways ?? true,
    availableStartDate: s.availableStartDate ?? null,
    availableEndDate: s.availableEndDate ?? null,
  }));
}

/** Reads incoming host requests from storage, seeded from JSON. */
async function readRequests(): Promise<HostRequest[]> {
  return readPersisted<HostRequest[]>(STORAGE_KEYS.requests, seedRequests);
}

/** Returns all of the host's parking listings. */
async function getListings(): Promise<ParkingSpot[]> {
  if (isApiEnabled()) return apiHost.getListings();
  await delay(randomLatency());
  // Fold the availability window into `available` for display parity with the
  // server (an out-of-window listing shows as Paused). Done here, NOT in
  // readListings, so create/delete keep writing back the raw stored flag.
  const raw = await readListings();
  return raw.map((s) => ({
    ...s,
    available: (s.available !== false) && isWithinAvailabilityWindow(s),
  }));
}

/** Creates a new host listing from the payload and persists it. */
async function createListing(payload: CreateListingPayload): Promise<ParkingSpot> {
  if (isApiEnabled()) return apiHost.createListing(payload);
  await delay(randomLatency());

  const template = seedListings[0];
  const host = template ? clone(template.host) : {
    id: "u1",
    name: "You",
    avatar: "https://i.pravatar.cc/150?img=12",
    rating: 5,
    reviewsCount: 0,
    verified: true,
    responseTime: "within an hour",
  };

  const id = genId("spot");
  const listing: ParkingSpot = {
    id,
    title: payload.title.trim(),
    hostId: host.id,
    host,
    type: payload.type,
    vehicleTypes: payload.vehicleTypes.length ? payload.vehicleTypes : ["car"],
    capacity: Math.max(1, Math.round(payload.capacity || 1)),
    remainingCount: Math.max(1, Math.round(payload.capacity || 1)),
    views: 0,
    address: payload.address.trim(),
    area: payload.area.trim(),
    // No fallback city — a listing's city is whatever the host's real
    // picked location says, or blank (never a guessed/hardcoded place).
    city: (payload.city ?? "").trim(),
    landmark: payload.landmark.trim(),
    nearStation: payload.nearStation.trim(),
    distanceMeters: 400,
    latitude: payload.latitude,
    longitude: payload.longitude,
    pricePerHour: payload.isFree ? 0 : payload.pricePerHour,
    pricePerDay: payload.isFree ? 0 : payload.pricePerDay,
    isFree: !!payload.isFree,
    rating: 0,
    reviewsCount: 0,
    images: payload.images && payload.images.length ? payload.images : [],
    amenities: payload.amenities ?? [],
    availableFrom: payload.availableFrom,
    availableTo: payload.availableTo,
    instructions: payload.instructions?.trim() ?? "",
    isFavorite: false,
    available: true,
    availableAlways: payload.availableAlways ?? true,
    availableStartDate: payload.availableStartDate ?? null,
    availableEndDate: payload.availableEndDate ?? null,
  };

  const existing = await readListings();
  const next = [listing, ...existing];
  await writePersisted(STORAGE_KEYS.listings, next);
  return clone(listing);
}

/** Returns all incoming booking requests for the host. */
async function getRequests(): Promise<HostRequest[]> {
  if (isApiEnabled()) return apiHost.getRequests();
  await delay(randomLatency());
  return readRequests();
}

/**
 * Responds to a host request by accepting or declining it, persists the new
 * status, and returns the updated request.
 */
async function respond(id: string, accept: boolean): Promise<HostRequest> {
  if (isApiEnabled()) return apiHost.respond(id, accept);
  await delay(randomLatency());
  const all = await readRequests();
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) {
    throw new Error("Request not found.");
  }
  // Capacity guard (demo parity with the server): accepting must consume a
  // slot on the listed space, and a full space can't accept more.
  if (accept && all[idx].status !== "accepted") {
    try {
      const listings = await readPersisted<ParkingSpot[]>(STORAGE_KEYS.listings, []);
      const spotIdx = listings.findIndex((s) => s.title === all[idx].spotTitle);
      if (spotIdx !== -1) {
        const spot = listings[spotIdx];
        const capacity = Math.max(1, Number(spot.capacity) || 1);
        const remaining = Math.max(0, Number(spot.remainingCount ?? capacity) || 0);
        if (remaining <= 0) {
          throw new Error(
            `All ${capacity} spot${capacity > 1 ? "s" : ""} are already taken. Decline this request or wait for a spot to free up.`
          );
        }
        listings[spotIdx] = { ...spot, capacity, remainingCount: remaining - 1 };
        await writePersisted(STORAGE_KEYS.listings, listings);
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("already taken")) throw e;
      // Any storage hiccup: accept anyway (demo mode is best-effort).
    }
  }

  all[idx] = { ...all[idx], status: accept ? "accepted" : "declined" };
  await writePersisted(STORAGE_KEYS.requests, all);

  // Accepting reveals the host's phone on the driver's linked booking;
  // declining cancels it. (In demo mode you play both roles on one device.)
  const bookingId = all[idx].bookingId;
  if (bookingId) {
    try {
      const bookings = await readPersisted<Booking[]>(STORAGE_KEYS.bookings, []);
      const bIdx = bookings.findIndex((b) => b.id === bookingId);
      if (bIdx !== -1) {
        if (accept) {
          const session = await authService.getSession();
          bookings[bIdx] = {
            ...bookings[bIdx],
            status: "confirmed",
            contactUnlocked: true,
            hostPhone: session?.phone ?? bookings[bIdx].hostPhone ?? null,
          };
        } else {
          bookings[bIdx] = {
            ...bookings[bIdx],
            status: "cancelled",
            contactUnlocked: false,
            hostPhone: null,
          };
        }
        await writePersisted(STORAGE_KEYS.bookings, bookings);
      }
    } catch {
      // Booking sync is best-effort in demo mode.
    }
  }

  return clone(all[idx]);
}

/**
 * Host removes a listing. On the API this cascade-cancels every live booking
 * and declines every pending request on the spot server-side; in demo mode we
 * mirror that locally. Returns how many bookings were cancelled.
 */
async function deleteListing(id: string): Promise<{ cancelledBookings: number }> {
  if (isApiEnabled()) {
    const res = await apiHost.deleteListing(id);
    return { cancelledBookings: res.cancelledBookings };
  }
  await delay(randomLatency());

  const listings = await readListings();
  const removed = listings.find((s) => s.id === id);
  const next = listings.filter((s) => s.id !== id);
  await writePersisted(STORAGE_KEYS.listings, next);

  let cancelledBookings = 0;
  // Cancel every live booking on this spot (drivers see it as cancelled).
  try {
    const bookings = await readPersisted<Booking[]>(STORAGE_KEYS.bookings, []);
    const liveBookingIds = new Set<string>();
    let changed = false;
    for (let i = 0; i < bookings.length; i++) {
      const b = bookings[i];
      if (
        b.spotId === id &&
        (b.status === "pending" || b.status === "confirmed" || b.status === "active")
      ) {
        liveBookingIds.add(b.id);
        bookings[i] = { ...b, status: "cancelled", contactUnlocked: false, hostPhone: null };
        changed = true;
        cancelledBookings++;
      }
    }
    if (changed) await writePersisted(STORAGE_KEYS.bookings, bookings);

    // Decline the spot's pending incoming requests (matched by linked booking
    // or, for older rows without a bookingId, by the spot's title).
    const requests = await readPersisted<HostRequest[]>(STORAGE_KEYS.requests, []);
    let reqChanged = false;
    for (let i = 0; i < requests.length; i++) {
      const r = requests[i];
      const matches =
        (r.bookingId && liveBookingIds.has(r.bookingId)) ||
        (removed && r.spotTitle === removed.title);
      if (matches && r.status === "pending") {
        requests[i] = { ...r, status: "declined" };
        reqChanged = true;
      }
    }
    if (reqChanged) await writePersisted(STORAGE_KEYS.requests, requests);
  } catch {
    // Best-effort in demo mode; the listing is already removed above.
  }

  return { cancelledBookings };
}

export const hostService = {
  getListings,
  createListing,
  deleteListing,
  getRequests,
  respond,
};
