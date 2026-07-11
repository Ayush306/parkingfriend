/**
 * Ola Maps API key — for real India-specific place search (chowks, sectors,
 * societies, company names) that free global geocoders like Photon don't
 * have. Ola Maps is built on India's own map data and gives a generous free
 * tier with no credit card:
 *
 *   1. Sign up:  https://cloud.olakrutrim.com/signUp   (no card needed)
 *   2. Create a "Places" API key from the Ola Krutrim / Ola Maps console.
 *   3. Paste the key below.
 *
 * Leave OLA_MAPS_API_KEY empty ("") to keep using the free Photon geocoder
 * (city/state-level results only, no key needed) — the app works either way.
 */
export const OLA_MAPS_API_KEY: string = "";

export function isOlaMapsEnabled(): boolean {
  return OLA_MAPS_API_KEY.trim().length > 0;
}
