import type { ParkingSpot, VehicleType } from "@/models/types";
import spotsData from "@/data/spots.json";
import {
  clone,
  delay,
  randomLatency,
  readPersisted,
  STORAGE_KEYS,
  writePersisted,
} from "@/services/mockClient";
import { isApiEnabled } from "@/config/apiConfig";
import { apiSpots } from "@/services/api/apiServices";
import { isWithinAvailabilityWindow } from "@/utils/availability";

const seedSpots = spotsData as unknown as ParkingSpot[];

/**
 * All spots visible in the marketplace = bundled spots (none in production)
 * merged with every space the user has listed on this device, so a listing
 * you create is immediately findable in search.
 */
async function readAllSpots(): Promise<ParkingSpot[]> {
  const listed = await readPersisted<ParkingSpot[]>(STORAGE_KEYS.listings, []);
  const seen = new Set(seedSpots.map((s) => s.id));
  return [...seedSpots, ...listed.filter((s) => !seen.has(s.id))].map((s) => ({
    ...s,
    // Older local listings pre-date capacity — default them to 1 slot.
    capacity: Math.max(1, Number(s.capacity) || 1),
    remainingCount: Math.max(
      0,
      Number(s.remainingCount ?? s.capacity ?? 1) || 0
    ),
    // Legacy random-placeholder photos render as vehicle graphics instead.
    images: (s.images ?? []).filter((u) => !String(u).includes("picsum.photos")),
    views: Math.max(0, Number(s.views) || 0),
    // Demo parity with the server: fold the from→to date window into
    // `available` so an out-of-window listing reads as closed and drops out of
    // the availableOnly search filters. (Read-only path — never written back.)
    available: (s.available !== false) && isWithinAvailabilityWindow(s),
  }));
}

export interface SpotFilters {
  /** Text query matched against title, area, landmark, station, city. */
  query?: string;
  /** Filter by parking spot type. */
  type?: ParkingSpot["type"] | null;
  /** Filter by supported vehicle type. */
  vehicleType?: VehicleType | null;
  /** Only spots at or below this per-day price. */
  maxPrice?: number | null;
  /** Only spots near this station name. */
  station?: string | null;
  /** Only spots that are free. */
  freeOnly?: boolean;
  /** Only spots currently available. */
  availableOnly?: boolean;
  /** Sort order for the result set. */
  sort?: "recommended" | "priceLow" | "priceHigh" | "rating" | "distance";
}

/** Reads the persisted set of favorited spot ids. */
async function readFavoriteIds(): Promise<string[]> {
  return readPersisted<string[]>(STORAGE_KEYS.favorites, []);
}

/** Returns a fresh copy of all spots with favorite flags applied. */
async function decorate(spots: ParkingSpot[]): Promise<ParkingSpot[]> {
  const favIds = await readFavoriteIds();
  const favSet = new Set(favIds);
  return spots.map((s) => ({ ...clone(s), isFavorite: favSet.has(s.id) }));
}

/** Nearby spots sorted by distance ascending. */
async function getNearby(): Promise<ParkingSpot[]> {
  if (isApiEnabled()) return apiSpots.getNearby();
  await delay(randomLatency());
  const decorated = await decorate(await readAllSpots());
  return decorated
    .filter((s) => s.available)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/** Popular spots sorted by rating then review count descending. */
async function getPopular(): Promise<ParkingSpot[]> {
  if (isApiEnabled()) return apiSpots.getPopular();
  await delay(randomLatency());
  const decorated = await decorate(await readAllSpots());
  return decorated
    .slice()
    .sort((a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount);
}

/** Full text + filter search across all spots. */
async function search(query: string, filters: SpotFilters = {}): Promise<ParkingSpot[]> {
  if (isApiEnabled()) return apiSpots.search(query, filters);
  await delay(randomLatency());
  let results = await decorate(await readAllSpots());

  const q = (query ?? filters.query ?? "").trim().toLowerCase();
  if (q.length > 0) {
    results = results.filter((s) => {
      const haystack = [
        s.title,
        s.area,
        s.city,
        s.landmark,
        s.nearStation,
        s.address,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  if (filters.type) {
    results = results.filter((s) => s.type === filters.type);
  }
  if (filters.vehicleType) {
    results = results.filter((s) => s.vehicleTypes.includes(filters.vehicleType!));
  }
  if (typeof filters.maxPrice === "number") {
    results = results.filter((s) => s.pricePerDay <= filters.maxPrice!);
  }
  if (filters.station) {
    const st = filters.station.toLowerCase();
    results = results.filter((s) => s.nearStation.toLowerCase().includes(st));
  }
  if (filters.freeOnly) {
    results = results.filter((s) => s.isFree);
  }
  if (filters.availableOnly) {
    results = results.filter((s) => s.available);
  }

  switch (filters.sort) {
    case "priceLow":
      results.sort((a, b) => a.pricePerDay - b.pricePerDay);
      break;
    case "priceHigh":
      results.sort((a, b) => b.pricePerDay - a.pricePerDay);
      break;
    case "rating":
      results.sort((a, b) => b.rating - a.rating);
      break;
    case "distance":
      results.sort((a, b) => a.distanceMeters - b.distanceMeters);
      break;
    case "recommended":
    default:
      results.sort(
        (a, b) => b.rating - a.rating || a.distanceMeters - b.distanceMeters
      );
      break;
  }

  return results;
}

/**
 * Records that a driver opened this spot (increments its view count).
 * Fire-and-forget — failures are swallowed so viewing never breaks. In demo
 * mode it bumps the count on the user's own stored listing if it's theirs.
 */
async function recordView(id: string): Promise<void> {
  if (isApiEnabled()) {
    await apiSpots.recordView(id).catch(() => {});
    return;
  }
  try {
    const listings = await readPersisted<ParkingSpot[]>(STORAGE_KEYS.listings, []);
    const idx = listings.findIndex((s) => s.id === id);
    if (idx !== -1) {
      listings[idx] = {
        ...listings[idx],
        views: Math.max(0, Number(listings[idx].views) || 0) + 1,
      };
      await writePersisted(STORAGE_KEYS.listings, listings);
    }
  } catch {
    // Best-effort in demo mode.
  }
}

/** Returns a single spot by id, or null if not found. */
async function getById(id: string): Promise<ParkingSpot | null> {
  if (isApiEnabled()) return apiSpots.getById(id);
  await delay(randomLatency());
  const match = (await readAllSpots()).find((s) => s.id === id);
  if (!match) return null;
  const [decorated] = await decorate([match]);
  return decorated;
}

/** All spots the user has favorited (favorites are stored on-device). */
async function getFavorites(): Promise<ParkingSpot[]> {
  if (isApiEnabled()) {
    const favIds = await readFavoriteIds();
    const favSet = new Set(favIds);
    const spots = await apiSpots.search("", {});
    return spots.filter((s) => favSet.has(s.id));
  }
  await delay(randomLatency());
  const favIds = await readFavoriteIds();
  const favSet = new Set(favIds);
  const decorated = await decorate(await readAllSpots());
  return decorated.filter((s) => favSet.has(s.id));
}

/**
 * Toggles favorite state for a spot, persists it, and returns the new
 * boolean state (true = now favorited).
 */
async function toggleFavorite(id: string): Promise<boolean> {
  const favIds = await readFavoriteIds();
  const set = new Set(favIds);
  let nowFav: boolean;
  if (set.has(id)) {
    set.delete(id);
    nowFav = false;
  } else {
    set.add(id);
    nowFav = true;
  }
  await writePersisted(STORAGE_KEYS.favorites, Array.from(set));
  return nowFav;
}

/** Returns the current list of favorited spot ids. */
async function getFavoriteIds(): Promise<string[]> {
  return readFavoriteIds();
}

export const spotService = {
  getNearby,
  getPopular,
  search,
  getById,
  recordView,
  getFavorites,
  getFavoriteIds,
  toggleFavorite,
};
