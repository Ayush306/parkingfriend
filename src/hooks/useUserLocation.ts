import { useEffect, useState } from "react";
import * as Location from "expo-location";

/**
 * The device's current GPS position, shared app-wide.
 *
 * One real GPS fix is fetched and cached at module level (2-minute TTL), so
 * however many cards/screens ask for it at once, the phone's GPS runs once.
 * Everything is best-effort: no permission or no fix simply means `null`,
 * and callers hide their "distance from you" labels.
 */

export interface UserCoords {
  latitude: number;
  longitude: number;
}

const TTL_MS = 2 * 60 * 1000;

let cached: { coords: UserCoords; at: number } | null = null;
let inFlight: Promise<UserCoords | null> | null = null;

async function fetchLocation(): Promise<UserCoords | null> {
  try {
    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      ({ status } = await Location.requestForegroundPermissionsAsync());
    }
    if (status !== "granted") return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const coords = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };
    cached = { coords, at: Date.now() };
    return coords;
  } catch {
    // Last known position beats nothing (e.g. GPS timeout indoors).
    try {
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        const coords = {
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
        };
        cached = { coords, at: Date.now() };
        return coords;
      }
    } catch {
      /* ignore */
    }
    return null;
  }
}

/** Resolves the user's position (cached ≤2 min). Null when unavailable. */
export function getUserLocation(): Promise<UserCoords | null> {
  if (cached && Date.now() - cached.at < TTL_MS) {
    return Promise.resolve(cached.coords);
  }
  if (!inFlight) {
    inFlight = fetchLocation().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** The user's GPS position, or null while loading / when unavailable. */
export function useUserLocation(): UserCoords | null {
  // Serve the cache instantly so lists don't flash "no distance" first.
  const [coords, setCoords] = useState<UserCoords | null>(
    cached && Date.now() - cached.at < TTL_MS ? cached.coords : null
  );

  useEffect(() => {
    let alive = true;
    getUserLocation().then((c) => {
      if (alive && c) setCoords(c);
    });
    return () => {
      alive = false;
    };
  }, []);

  return coords;
}
