/**
 * Opens turn-by-turn directions to a real lat/lng in Google Maps (app if
 * installed, else the Google Maps website) via Google's documented,
 * no-API-key Maps URLs scheme: developers.google.com/maps/documentation/urls.
 * Works on iOS, Android, and web — Linking.openURL on web opens a new tab.
 */
import { Linking } from "react-native";

/** Builds the universal "get directions" URL for a destination coordinate. */
export function buildDirectionsUrl(latitude: number, longitude: number): string {
  const destination = `${latitude},${longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}

/**
 * Opens Google Maps directions to the given coordinate.
 * Resolves true on success; resolves false (never throws) if the URL
 * couldn't be opened, so callers can show their own error toast.
 */
export async function openDirections(
  latitude: number,
  longitude: number
): Promise<boolean> {
  const url = buildDirectionsUrl(latitude, longitude);
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
