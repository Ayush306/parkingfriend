import {
  readPersisted,
  writePersisted,
  genId,
  STORAGE_KEYS,
} from "@/services/mockClient";
import type { Place } from "@/services/placesService";

export interface RecentSearch {
  id: string;
  name: string;
  label?: string;
  latitude?: number;
  longitude?: number;
  searchedAt: string;
}

const MAX_RECENT = 8;

/** Most recent searches first. */
async function list(): Promise<RecentSearch[]> {
  return readPersisted<RecentSearch[]>(STORAGE_KEYS.recentSearches, []);
}

/**
 * Records a search (a picked Place, or free-typed text) at the top of the
 * list. De-duplicates by name (case-insensitive) so re-searching the same
 * place just bumps it to the top instead of creating a second row.
 */
async function add(entry: {
  name: string;
  label?: string;
  latitude?: number;
  longitude?: number;
}): Promise<void> {
  const name = entry.name.trim();
  if (!name) return;
  const existing = await list();
  const deduped = existing.filter(
    (s) => s.name.toLowerCase() !== name.toLowerCase()
  );
  const next: RecentSearch[] = [
    {
      id: genId("rs"),
      name,
      label: entry.label,
      latitude: entry.latitude,
      longitude: entry.longitude,
      searchedAt: new Date().toISOString(),
    },
    ...deduped,
  ].slice(0, MAX_RECENT);
  await writePersisted(STORAGE_KEYS.recentSearches, next);
}

/** Convenience wrapper for saving a picked Place directly. */
async function addPlace(place: Place): Promise<void> {
  await add({
    name: place.name,
    label: place.label,
    latitude: place.latitude,
    longitude: place.longitude,
  });
}

async function remove(id: string): Promise<void> {
  const existing = await list();
  await writePersisted(
    STORAGE_KEYS.recentSearches,
    existing.filter((s) => s.id !== id)
  );
}

async function clear(): Promise<void> {
  await writePersisted(STORAGE_KEYS.recentSearches, []);
}

export const recentSearchesService = { list, add, addPlace, remove, clear };
