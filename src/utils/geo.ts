/** Geo helpers for "parking near this place" filtering. */

/** Great-circle distance between two coordinates, in meters (haversine). */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/** "350 m away" / "2.4 km away" */
export function formatAway(meters: number): string {
  if (meters < 1000) return `${meters} m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
}
