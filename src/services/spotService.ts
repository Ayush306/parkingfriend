import type { ParkingSpot } from "@/models/types";
import spotsData from "@/data/spots.json";
import {
  clone,
  delay,
  randomLatency,
  readPersisted,
  STORAGE_KEYS,
  writePersisted,
} from "@/services/mockClient";

const allSpots = spotsData as unknown as ParkingSpot[];

export interface SpotFilters {
  /** Text query matched against title, area, landmark, station, city. */
  query?: string;
  /** Filter by parking spot type. */
  type?: ParkingSpot["type"] | null;
  /** Filter by supported vehicle type. */
  vehicleType?: "car" | "bike" | "suv" | null;
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

/** Reads the persisted set of favorited spot ids (seeded from JSON flags). */
async function readFavoriteIds(): Promise<string[]> {
  const seedFavorites = allSpots
    .filter((s) => s.isFavorite)
    .map((s) => s.id);
  return readPersisted<string[]>(STORAGE_KEYS.favorites, seedFavorites);
}

/** Returns a fresh copy of all spots with favorite flags applied. */
async function decorate(spots: ParkingSpot[]): Promise<ParkingSpot[]> {
  const favIds = await readFavoriteIds();
  const favSet = new Set(favIds);
  return spots.map((s) => ({ ...clone(s), isFavorite: favSet.has(s.id) }));
}

/** Nearby spots sorted by distance ascending. */
async function getNearby(): Promise<ParkingSpot[]> {
  await delay(randomLatency());
  const decorated = await decorate(allSpots);
  return decorated
    .filter((s) => s.available)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/** Popular spots sorted by rating then review count descending. */
async function getPopular(): Promise<ParkingSpot[]> {
  await delay(randomLatency());
  const decorated = await decorate(allSpots);
  return decorated
    .slice()
    .sort((a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount);
}

/** Full text + filter search across all spots. */
async function search(query: string, filters: SpotFilters = {}): Promise<ParkingSpot[]> {
  await delay(randomLatency());
  let results = await decorate(allSpots);

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

/** Returns a single spot by id, or null if not found. */
async function getById(id: string): Promise<ParkingSpot | null> {
  await delay(randomLatency());
  const match = allSpots.find((s) => s.id === id);
  if (!match) return null;
  const [decorated] = await decorate([match]);
  return decorated;
}

/** All spots the user has favorited. */
async function getFavorites(): Promise<ParkingSpot[]> {
  await delay(randomLatency());
  const favIds = await readFavoriteIds();
  const favSet = new Set(favIds);
  const decorated = await decorate(allSpots);
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
  getFavorites,
  getFavoriteIds,
  toggleFavorite,
};
