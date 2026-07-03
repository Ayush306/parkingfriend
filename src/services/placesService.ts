/**
 * Real place lookup (geocoding) via Photon — a FREE OpenStreetMap-based
 * geocoder from Komoot. No API key required.
 *   https://photon.komoot.io/
 *
 * This finds real places anywhere (cities, towns, stations, landmarks) and
 * returns their real coordinates so the map can center on them. It does NOT
 * return parking spots — those are Parkmitter's own listings.
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

async function search(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    // Bias results toward Delhi NCR so nearby places rank first, but still
    // allow anywhere in the world.
    const url =
      "https://photon.komoot.io/api/?q=" +
      encodeURIComponent(q) +
      "&limit=6&lang=en&lat=28.6139&lon=77.209";

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error("Place lookup failed (" + res.status + ")");
    const json: any = await res.json();
    const features: any[] = Array.isArray(json?.features) ? json.features : [];

    const places: Place[] = [];
    for (let i = 0; i < features.length; i += 1) {
      const f = features[i];
      const p = f?.properties ?? {};
      const coords = f?.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;
      const lon = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!isFinite(lat) || !isFinite(lon)) continue;

      const name: string = p.name || p.street || p.city || "Unknown place";
      const parts = [p.city, p.county, p.state, p.country].filter(
        (x: any, idx: number, arr: any[]) =>
          !!x && arr.indexOf(x) === idx && x !== name
      );
      const label = parts.length
        ? parts.join(", ")
        : String(p.type || p.osm_value || "");

      places.push({
        id: `${p.osm_type || "x"}-${p.osm_id || i}`,
        name,
        label,
        latitude: lat,
        longitude: lon,
        kind: String(p.osm_value || p.type || "place"),
      });
    }
    return places;
  } finally {
    clearTimeout(timer);
  }
}

export const placesService = { search };
