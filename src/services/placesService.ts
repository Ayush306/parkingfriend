/**
 * Real place lookup (geocoding), Ola Maps first with Photon as a fallback.
 *
 * Ola Maps (https://maps.olakrutrim.com) is built on India's own map data —
 * it finds chowks, colonies, societies and company/shop names that Photon's
 * global OpenStreetMap data mostly doesn't have. When OLA_MAPS_API_KEY (see
 * "@/config/olaMapsConfig") is set, `search()` and `reverse()` try Ola Maps
 * first and silently fall back to Photon on any error/empty result — so the
 * app degrades to its old behavior instead of breaking if Ola is ever down.
 *
 * - `search(query)`     forward geocoding: text -> real places (with coords).
 * - `reverse(lat,lon)`  reverse geocoding: a coordinate -> the nearest place.
 * - `nearby(lat,lon)`   several real places/landmarks around a coordinate
 *                       (stays on Photon: Ola's nearby-search doesn't return
 *                       coordinates per result, which this needs to move the
 *                       map pin when a landmark is tapped).
 *
 * None of these return parking spots — those are ParkingFriend's own listings.
 */
import { OLA_MAPS_API_KEY, isOlaMapsEnabled } from "@/config/olaMapsConfig";

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

/** Fetches Ola Maps JSON with a hard 8s timeout; throws on any failure. */
async function fetchOla(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error("Ola Maps request failed (" + res.status + ")");
    const json: any = await res.json();
    if (json?.status && json.status !== "ok") {
      throw new Error("Ola Maps status: " + json.status);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/** Maps one Ola Maps autocomplete prediction to a Place, or null without coords. */
function predictionToPlace(p: any, fallbackIdx: number): Place | null {
  const loc = p?.geometry?.location;
  const lat = Number(loc?.lat);
  const lon = Number(loc?.lng);
  if (!isFinite(lat) || !isFinite(lon)) return null;
  const sf = p?.structured_formatting ?? {};
  return {
    id: String(p?.place_id ?? `ola-${fallbackIdx}`),
    name: sf.main_text || p?.description || "Unknown place",
    label: sf.secondary_text || "",
    latitude: lat,
    longitude: lon,
    kind: Array.isArray(p?.types) ? String(p.types[0] ?? "place") : "place",
  };
}

/** Maps one Ola Maps reverse-geocode result to a Place, or null without coords. */
function reverseResultToPlace(r: any, fallbackIdx: number): Place | null {
  const loc = r?.geometry?.location;
  const lat = Number(loc?.lat);
  const lon = Number(loc?.lng);
  if (!isFinite(lat) || !isFinite(lon)) return null;
  const name: string = r?.name || "Unknown place";
  const label = String(r?.formatted_address || "")
    .split(",")
    .map((s: string) => s.trim())
    .filter((s: string, idx: number, arr: string[]) => s && s !== name && arr.indexOf(s) === idx)
    .join(", ");
  return {
    id: String(r?.place_id ?? `ola-rev-${fallbackIdx}`),
    name,
    label,
    latitude: lat,
    longitude: lon,
    kind: Array.isArray(r?.types) ? String(r.types[0] ?? "place") : "place",
  };
}

/** Forward geocoding via Ola Maps autocomplete — real Indian chowks/colonies/companies. */
async function olaSearch(query: string): Promise<Place[]> {
  const url =
    "https://api.olamaps.io/places/v1/autocomplete?input=" +
    encodeURIComponent(query) +
    "&api_key=" +
    OLA_MAPS_API_KEY;
  const json = await fetchOla(url);
  const predictions: any[] = Array.isArray(json?.predictions) ? json.predictions : [];
  const places: Place[] = [];
  for (let i = 0; i < predictions.length; i += 1) {
    const place = predictionToPlace(predictions[i], i);
    if (place) places.push(place);
  }
  return places;
}

/** Reverse geocoding via Ola Maps — the most specific real place at a coordinate. */
async function olaReverse(lat: number, lon: number): Promise<Place | null> {
  const url =
    "https://api.olamaps.io/places/v1/reverse-geocode?latlng=" +
    encodeURIComponent(`${lat},${lon}`) +
    "&api_key=" +
    OLA_MAPS_API_KEY;
  const json = await fetchOla(url);
  const results: any[] = Array.isArray(json?.results) ? json.results : [];
  return reverseResultToPlace(results[0], 0);
}

/** Forward geocoding — free text to real places. */
async function search(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  if (isOlaMapsEnabled()) {
    try {
      const places = await olaSearch(q);
      if (places.length > 0) return places;
    } catch {
      // Fall through to Photon below.
    }
  }

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
  if (isOlaMapsEnabled()) {
    try {
      const place = await olaReverse(lat, lon);
      if (place) return place;
    } catch {
      // Fall through to Photon below.
    }
  }
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
