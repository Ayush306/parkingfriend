/**
 * Real place lookup (geocoding) via Photon — a FREE OpenStreetMap-based
 * geocoder from Komoot. No API key required.
 *   https://photon.komoot.io/
 *
 * - `search(query)`     forward geocoding: text -> real places (with coords).
 * - `reverse(lat,lon)`  reverse geocoding: a coordinate -> the nearest place.
 * - `nearby(lat,lon)`   several real places/landmarks around a coordinate.
 *
 * None of these return parking spots — those are ParkingFriend's own listings.
 */

export interface Place {
  id: string;
  /** Primary name, e.g. "Baraut". */
  name: string;
  /** Region label, e.g. "Baghpat, Uttar Pradesh, India". */
  label: string;
  latitude: number;
  longitude: number;
  /** OSM value/type, e.g. "city", "station", "suburb". */
  kind: string;
}

/** Maps one Photon GeoJSON feature to a Place (or null if it has no coords). */
function featureToPlace(feature: any, fallbackIdx: number): Place | null {
  const p = feature?.properties ?? {};
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lon = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!isFinite(lat) || !isFinite(lon)) return null;

  const name: string = p.name || p.street || p.city || p.county || "Unknown place";
  const parts = [p.city, p.county, p.state, p.country].filter(
    (x: any, idx: number, arr: any[]) =>
      !!x && arr.indexOf(x) === idx && x !== name
  );
  const label = parts.length
    ? parts.join(", ")
    : String(p.type || p.osm_value || "");

  return {
    id: `${p.osm_type || "x"}-${p.osm_id || fallbackIdx}`,
    name,
    label,
    latitude: lat,
    longitude: lon,
    kind: String(p.osm_value || p.type || "place"),
  };
}

/** Fetches Photon JSON with a hard 10s timeout, returns parsed features. */
async function fetchFeatures(url: string): Promise<any[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error("Place lookup failed (" + res.status + ")");
    const json: any = await res.json();
    return Array.isArray(json?.features) ? json.features : [];
  } finally {
    clearTimeout(timer);
  }
}

/** Forward geocoding — free text to real places. */
async function search(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  // Bias toward Delhi NCR so nearby places rank first, but allow anywhere.
  const url =
    "https://photon.komoot.io/api/?q=" +
    encodeURIComponent(q) +
    "&limit=6&lang=en&lat=28.6139&lon=77.209";
  const features = await fetchFeatures(url);
  const places: Place[] = [];
  for (let i = 0; i < features.length; i += 1) {
    const place = featureToPlace(features[i], i);
    if (place) places.push(place);
  }
  return places;
}

/** Reverse geocoding — the single nearest real place to a coordinate. */
async function reverse(lat: number, lon: number): Promise<Place | null> {
  const list = await reverseNearby(lat, lon, 1);
  return list[0] ?? null;
}

/** Several real places/landmarks around a coordinate (nearest first). */
async function nearby(
  lat: number,
  lon: number,
  limit: number = 8
): Promise<Place[]> {
  return reverseNearby(lat, lon, limit);
}

async function reverseNearby(
  lat: number,
  lon: number,
  limit: number
): Promise<Place[]> {
  if (!isFinite(lat) || !isFinite(lon)) return [];
  const url =
    "https://photon.komoot.io/reverse?lat=" +
    encodeURIComponent(String(lat)) +
    "&lon=" +
    encodeURIComponent(String(lon)) +
    "&limit=" +
    encodeURIComponent(String(limit)) +
    "&lang=en";
  const features = await fetchFeatures(url);
  const places: Place[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < features.length; i += 1) {
    const place = featureToPlace(features[i], i);
    // De-dupe by name so the landmark list isn't full of repeats.
    if (place && !seen.has(place.name)) {
      seen.add(place.name);
      places.push(place);
    }
  }
  return places;
}

export const placesService = { search, reverse, nearby };
