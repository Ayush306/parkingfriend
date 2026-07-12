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
  /** Real coordinates chosen on the map (falls back to Gurugram centre). */
  latitude?: number;
  longitude?: number;
  pricePerHour: number;
  pricePerDay: number;
  isFree?: boolean;
  amenities?: string[];
  availableFrom: string;
  availableTo: string;
  instructions?: string;
  images?: string[];
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
  return readListings();
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
    address: payload.address.trim(),
    area: payload.area.trim(),
    city: (payload.city ?? "Gurugram").trim(),
    landmark: payload.landmark.trim(),
    nearStation: payload.nearStation.trim(),
    distanceMeters: 400,
    latitude: payload.latitude ?? 28.4595,
    longitude: payload.longitude ?? 77.0266,
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

export const hostService = {
  getListings,
  createListing,
  getRequests,
  respond,
};
