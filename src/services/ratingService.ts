import type { Booking, PendingRating } from "@/models/types";
import { isApiEnabled } from "@/config/apiConfig";
import { apiRatings } from "@/services/api/apiServices";
import {
  delay,
  randomLatency,
  readPersisted,
  writePersisted,
  STORAGE_KEYS,
} from "@/services/mockClient";

/** Local record of ratings already left, so demo mode can clear its prompts. */
interface LocalRating {
  bookingId: string;
  role: "driver" | "host";
  stars: number;
}

/** Device-local today as YYYY-MM-DD. */
function todayYmd(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Bookings the user still needs to rate. In API mode the server computes this
 * for both roles; in demo mode (single device) we derive the DRIVER-side
 * prompts from the local bookings that are accepted and past-dated.
 */
async function getPending(): Promise<PendingRating[]> {
  if (isApiEnabled()) return apiRatings.getPending();
  await delay(randomLatency());
  const bookings = await readPersisted<Booking[]>(STORAGE_KEYS.bookings, []);
  const rated = await readPersisted<LocalRating[]>(STORAGE_KEYS.ratings, []);
  const ratedKeys = new Set(rated.map((r) => `${r.bookingId}:${r.role}`));
  const today = todayYmd();
  return bookings
    .filter(
      (b) =>
        (b.status === "confirmed" || b.status === "active") &&
        String(b.date) < today &&
        !ratedKeys.has(`${b.id}:driver`)
    )
    .map((b) => ({
      bookingId: b.id,
      role: "driver" as const,
      spotId: b.spotId,
      spotTitle: b.spot?.title ?? "Parking",
      date: b.date,
      counterparty: {
        id: b.spot?.host?.id ?? "",
        name: b.spot?.host?.name ?? "Host",
        avatar: b.spot?.host?.avatar ?? null,
        rating: Number(b.spot?.host?.rating) || 0,
        ratingCount: Number(b.spot?.host?.reviewsCount) || 0,
      },
    }));
}

/** Leave a rating (1–5 + optional comment) for a completed booking. */
async function submit(
  bookingId: string,
  stars: number,
  comment?: string
): Promise<void> {
  if (isApiEnabled()) return apiRatings.submit(bookingId, stars, comment);
  await delay(randomLatency());
  // Demo: remember it was rated (clears the prompt) and nudge the local spot's
  // star rating so the change is visible on this device.
  const rated = await readPersisted<LocalRating[]>(STORAGE_KEYS.ratings, []);
  rated.push({ bookingId, role: "driver", stars });
  await writePersisted(STORAGE_KEYS.ratings, rated);

  try {
    const bookings = await readPersisted<Booking[]>(STORAGE_KEYS.bookings, []);
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    const listings = await readPersisted<any[]>(STORAGE_KEYS.listings, []);
    const idx = listings.findIndex((s) => s.id === booking.spotId);
    if (idx !== -1) {
      const s = listings[idx];
      const count = (Number(s.reviewsCount) || 0) + 1;
      const avg =
        ((Number(s.rating) || 0) * (count - 1) + stars) / count;
      listings[idx] = { ...s, rating: Math.round(avg * 100) / 100, reviewsCount: count };
      await writePersisted(STORAGE_KEYS.listings, listings);
    }
  } catch {
    // Best-effort in demo mode.
  }
}

export const ratingService = { getPending, submit };
