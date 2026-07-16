/**
 * Availability-window helpers shared by the demo (no-API) service paths.
 *
 * In API mode the server folds the from→to date window into `spot.available`
 * (see server db.js isSpotAvailableNow / toSpot) and re-checks it on booking.
 * These helpers give the demo/local path the SAME behaviour so a dated listing
 * outside its window reads as closed and refuses bookings in both modes.
 */
import type { ParkingSpot } from "@/models/types";

type WindowFields = Pick<
  ParkingSpot,
  "availableAlways" | "availableStartDate" | "availableEndDate"
>;

/** Device-local today as "YYYY-MM-DD" (matches the server's date-string form). */
export function todayYmdLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * True if today falls inside the listing's availability window — or the
 * listing is always available (the default, and how legacy rows are treated).
 * Date strings compare correctly lexically in YYYY-MM-DD form.
 */
export function isWithinAvailabilityWindow(spot: WindowFields): boolean {
  if (spot.availableAlways ?? true) return true;
  const today = todayYmdLocal();
  if (spot.availableStartDate && today < spot.availableStartDate) return false;
  if (spot.availableEndDate && today > spot.availableEndDate) return false;
  return true;
}

/**
 * Effective availability for the demo path: the stored on/off flag AND the
 * date window. Mirrors the server's isSpotAvailableNow.
 */
export function isSpotOpenNow(spot: WindowFields & { available?: boolean }): boolean {
  return spot.available !== false && isWithinAvailabilityWindow(spot);
}
