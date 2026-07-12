/**
 * Real-backend implementations of the app services.
 *
 * Each function mirrors the corresponding mock-service function 1:1 so the
 * services can delegate here when API_URL is set (see src/config/apiConfig.ts).
 * Responses are normalized defensively: missing/renamed fields from the server
 * are filled with sane values so screens never crash on shape drift.
 */
import type {
  Booking,
  EarningEntry,
  HostRequest,
  ParkingSpot,
  User,
  WalletSummary,
} from "@/models/types";
import { http, setToken } from "@/services/api/http";
import {
  clone,
  readPersisted,
  writePersisted,
  STORAGE_KEYS,
} from "@/services/mockClient";
import type { SpotFilters } from "@/services/spotService";
import type { CreateBookingPayload } from "@/services/bookingService";
import type { CreateListingPayload } from "@/services/hostService";

/* ─────────────────────────── normalizers ─────────────────────────── */

function asArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeSpot(raw: any): ParkingSpot {
  const host = raw?.host ?? {};
  return {
    id: String(raw?.id ?? ""),
    title: raw?.title ?? "Parking spot",
    hostId: String(raw?.hostId ?? host?.id ?? ""),
    host: {
      id: String(host?.id ?? raw?.hostId ?? ""),
      name: host?.name ?? "Host",
      avatar: host?.avatar ?? undefined,
      rating: Number(host?.rating ?? 0),
      reviewsCount: Number(host?.reviewsCount ?? 0),
      verified: !!host?.verified,
      responseTime: host?.responseTime ?? "within a day",
    },
    type: raw?.type ?? "home",
    vehicleTypes: asArray(raw?.vehicleTypes).length
      ? (asArray(raw?.vehicleTypes) as ParkingSpot["vehicleTypes"])
      : ["car"],
    capacity: Math.max(1, Number(raw?.capacity ?? 1) || 1),
    remainingCount: Math.max(
      0,
      Number(raw?.remainingCount ?? raw?.capacity ?? 1) || 0
    ),
    views: Math.max(0, Number(raw?.views ?? 0) || 0),
    address: raw?.address ?? "",
    area: raw?.area ?? "",
    city: raw?.city ?? "",
    landmark: raw?.landmark ?? "",
    nearStation: raw?.nearStation ?? "",
    distanceMeters: Number(raw?.distanceMeters ?? 0),
    // No fallback city — the server always requires real coordinates, so
    // this only guards against a truly malformed response.
    latitude: Number(raw?.latitude ?? 0),
    longitude: Number(raw?.longitude ?? 0),
    pricePerHour: Number(raw?.pricePerHour ?? 0),
    pricePerDay: Number(raw?.pricePerDay ?? 0),
    isFree: !!raw?.isFree || Number(raw?.pricePerDay ?? 0) === 0,
    rating: Number(raw?.rating ?? 0),
    reviewsCount: Number(raw?.reviewsCount ?? 0),
    // No stock-photo fallback: an empty list means screens render the
    // vehicle-type SpotGraphic tile instead of a random image. Legacy rows
    // may still carry generated placeholder URLs — strip those too.
    images: asArray(raw?.images)
      .map(String)
      .filter((u) => !u.includes("picsum.photos")),
    amenities: asArray(raw?.amenities).map(String),
    availableFrom: raw?.availableFrom ?? "08:00",
    availableTo: raw?.availableTo ?? "20:00",
    instructions: raw?.instructions ?? "",
    isFavorite: false, // decorated from local favorites below
    available: raw?.available === undefined ? true : !!raw.available,
  };
}

function normalizeBooking(raw: any): Booking {
  const status: Booking["status"] =
    raw?.status === "upcoming" ? "confirmed" : raw?.status ?? "confirmed";
  const duration = Number(raw?.durationHours ?? 8);
  const start = raw?.startTime ?? raw?.time ?? "09:00";
  return {
    id: String(raw?.id ?? ""),
    spotId: String(raw?.spotId ?? raw?.spot?.id ?? ""),
    spot: normalizeSpot(raw?.spot ?? {}),
    userId: String(raw?.userId ?? ""),
    vehicleType: raw?.vehicleType ?? "car",
    vehicleNumber: raw?.vehicleNumber ?? "",
    date: raw?.date ?? new Date().toISOString().slice(0, 10),
    startTime: start,
    endTime: raw?.endTime ?? addHours(start, duration),
    durationHours: duration,
    amount: Number(raw?.amount ?? raw?.totalAmount ?? 0),
    status,
    createdAt: raw?.createdAt ?? new Date().toISOString(),
    contactUnlocked:
      raw?.contactUnlocked !== undefined
        ? !!raw.contactUnlocked
        : status === "confirmed" || status === "active",
    otp: raw?.otp ?? undefined,
    hostPhone: raw?.hostPhone ?? null,
  };
}

function addHours(hhmm: string, hours: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!m) return hhmm;
  const total = (parseInt(m[1], 10) + Math.round(hours)) % 24;
  return `${String(total).padStart(2, "0")}:${m[2]}`;
}

function normalizeUser(raw: any): User {
  return {
    id: String(raw?.id ?? ""),
    name: raw?.name ?? "ParkingFriend user",
    phone: raw?.phone ?? "",
    email: raw?.email ?? undefined,
    avatar: raw?.avatar ?? undefined,
    verified: !!raw?.verified,
    memberSince: raw?.memberSince ?? raw?.createdAt ?? new Date().toISOString(),
    rating: Number(raw?.rating ?? 5),
    role: raw?.role ?? "both",
  };
}

function normalizeRequest(raw: any): HostRequest {
  return {
    ...raw,
    id: String(raw?.id ?? ""),
    spotTitle: raw?.spotTitle ?? "Your space",
    requesterName: raw?.requesterName ?? "Driver",
    vehicleType: raw?.vehicleType ?? "car",
    status: raw?.status ?? "pending",
  } as HostRequest;
}

/** Apply the device-local favorite flags onto API spots. */
async function decorateFavorites(spots: ParkingSpot[]): Promise<ParkingSpot[]> {
  const favIds = await readPersisted<string[]>(STORAGE_KEYS.favorites, []);
  const set = new Set(favIds);
  return spots.map((s) => ({ ...s, isFavorite: set.has(s.id) }));
}

/* ─────────────────────────── auth ─────────────────────────── */

export const apiAuth = {
  async sendOtp(phone: string): Promise<{ success: boolean; message: string }> {
    await http.request("/api/auth/request-otp", {
      method: "POST",
      body: { phone },
      auth: false,
    });
    return {
      success: true,
      message: `We've sent a 6-digit code to ${phone.trim()}`,
    };
  },

  async verifyOtp(
    phone: string,
    code: string,
    extra?: { name?: string; email?: string }
  ): Promise<{ success: boolean; user: User; message: string }> {
    const body: Record<string, unknown> = { phone, otp: code };
    // Sending a name signals REGISTER; omitting it signals LOGIN.
    if (extra?.name) body.name = extra.name;
    if (extra?.email) body.email = extra.email;
    const res = await http.request<{ token: string; user: any }>(
      "/api/auth/verify-otp",
      { method: "POST", body, auth: false }
    );
    await setToken(res.token);
    return {
      success: true,
      user: normalizeUser(res.user),
      message: "Verified successfully",
    };
  },

  async logout(): Promise<void> {
    await setToken(null);
  },
};

/* ─────────────────────────── profile ─────────────────────────── */

export const apiUser = {
  async getProfile(): Promise<User> {
    const raw = await http.request<any>("/api/me");
    return normalizeUser(raw);
  },

  async updateProfile(patch: {
    name?: string;
    email?: string | undefined;
    avatar?: string | undefined;
  }): Promise<User> {
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) body.name = patch.name;
    // Send explicit "" to clear email/avatar server-side (the route treats
    // an empty string as "remove"); undefined means "leave unchanged".
    if (patch.email !== undefined) body.email = patch.email ?? "";
    if (patch.avatar !== undefined) body.avatar = patch.avatar ?? "";
    const raw = await http.request<any>("/api/me", { method: "PATCH", body });
    return normalizeUser(raw);
  },
};

/* ─────────────────────────── spots ─────────────────────────── */

const SORT_MAP: Record<string, string> = {
  recommended: "recommended",
  priceLow: "price_low",
  priceHigh: "price_high",
  rating: "rating",
  distance: "recommended", // server has no distance sort; sorted client-side below
};

export const apiSpots = {
  async search(query: string, filters: SpotFilters = {}): Promise<ParkingSpot[]> {
    const params = new URLSearchParams();
    const q = (query ?? filters.query ?? "").trim();
    if (q) params.set("query", q);
    if (filters.vehicleType) params.set("vehicleType", filters.vehicleType);
    if (filters.freeOnly) params.set("freeOnly", "true");
    if (typeof filters.maxPrice === "number")
      params.set("maxPrice", String(filters.maxPrice));
    params.set("sort", SORT_MAP[filters.sort ?? "recommended"] ?? "recommended");

    const raw = await http.request<any[]>(`/api/spots?${params.toString()}`, {
      auth: false,
    });
    let spots = (raw ?? []).map(normalizeSpot);

    // Filters the server doesn't know about are applied client-side.
    if (filters.type) spots = spots.filter((s) => s.type === filters.type);
    if (filters.station) {
      const st = filters.station.toLowerCase();
      spots = spots.filter((s) => s.nearStation.toLowerCase().includes(st));
    }
    if (filters.availableOnly) spots = spots.filter((s) => s.available);
    if (filters.sort === "distance")
      spots.sort((a, b) => a.distanceMeters - b.distanceMeters);

    return decorateFavorites(spots);
  },

  async getPopular(): Promise<ParkingSpot[]> {
    const raw = await http.request<any[]>("/api/spots/popular", { auth: false });
    return decorateFavorites((raw ?? []).map(normalizeSpot));
  },

  async getNearby(): Promise<ParkingSpot[]> {
    const spots = await apiSpots.search("", { sort: "distance", availableOnly: true });
    return spots;
  },

  async getById(id: string): Promise<ParkingSpot | null> {
    try {
      const raw = await http.request<any>(`/api/spots/${encodeURIComponent(id)}`, {
        auth: false,
      });
      const [spot] = await decorateFavorites([normalizeSpot(raw)]);
      return spot;
    } catch {
      return null;
    }
  },

  /** Record that a driver opened this spot's detail page. Fire-and-forget. */
  async recordView(id: string): Promise<number> {
    const res = await http.request<{ views: number }>(
      `/api/spots/${encodeURIComponent(id)}/view`,
      { method: "POST", body: {}, auth: false }
    );
    return Number(res?.views ?? 0) || 0;
  },
};

/* ─────────────────────────── bookings ─────────────────────────── */

export const apiBookings = {
  async list(): Promise<Booking[]> {
    const raw = await http.request<any[]>("/api/bookings");
    return (raw ?? []).map(normalizeBooking);
  },

  async create(payload: CreateBookingPayload): Promise<Booking> {
    // Minimal request — spotId is all the server needs; extras are optional.
    const body: Record<string, unknown> = { spotId: payload.spotId };
    if (payload.date) body.date = payload.date;
    if (payload.startTime) {
      body.time = payload.startTime;
      body.startTime = payload.startTime;
    }
    if (payload.endTime) body.endTime = payload.endTime;
    if (payload.durationHours) body.durationHours = payload.durationHours;
    if (payload.vehicleType) body.vehicleType = payload.vehicleType;
    if (payload.vehicleNumber) body.vehicleNumber = payload.vehicleNumber;
    if (payload.amount) body.amount = payload.amount;
    const raw = await http.request<any>("/api/bookings", {
      method: "POST",
      body,
    });
    return normalizeBooking(raw);
  },

  async getById(id: string): Promise<Booking | null> {
    const all = await apiBookings.list();
    return all.find((b) => b.id === id) ?? null;
  },

  async cancel(id: string): Promise<Booking> {
    const raw = await http.request<any>(
      `/api/bookings/${encodeURIComponent(id)}/cancel`,
      { method: "POST", body: {} }
    );
    return normalizeBooking(raw);
  },
};

/* ─────────────────────────── host ─────────────────────────── */

export const apiHost = {
  async getListings(): Promise<ParkingSpot[]> {
    const raw = await http.request<any[]>("/api/host/listings");
    return decorateFavorites((raw ?? []).map(normalizeSpot));
  },

  async createListing(payload: CreateListingPayload): Promise<ParkingSpot> {
    const raw = await http.request<any>("/api/host/listings", {
      method: "POST",
      body: payload,
    });
    return normalizeSpot(raw);
  },

  async getRequests(): Promise<HostRequest[]> {
    const raw = await http.request<any[]>("/api/host/requests");
    return (raw ?? []).map(normalizeRequest);
  },

  async respond(id: string, accept: boolean): Promise<HostRequest> {
    const raw = await http.request<any>(
      `/api/host/requests/${encodeURIComponent(id)}/respond`,
      { method: "POST", body: { accept } }
    );
    return normalizeRequest(raw);
  },
};

/* ─────────────────────────── wallet ─────────────────────────── */

export const apiWallet = {
  async getSummary(): Promise<WalletSummary> {
    const raw = await http.request<any>("/api/wallet/summary");
    return {
      savingsLast3Months: Number(raw?.savingsLast3Months ?? 0),
      savingsLifetime: Number(raw?.savingsLifetime ?? 0),
      earningsLast3Months: Number(raw?.earningsLast3Months ?? 0),
      earningsLifetime: Number(raw?.earningsLifetime ?? 0),
      completedAsDriver: Number(raw?.completedAsDriver ?? 0),
      completedAsHost: Number(raw?.completedAsHost ?? 0),
    };
  },

  async getEntries(): Promise<EarningEntry[]> {
    const raw = await http.request<any[]>("/api/wallet/entries");
    return (raw ?? []).map((e: any) => ({
      id: String(e?.id ?? ""),
      kind: e?.kind === "saving" ? "saving" : "earning",
      title: e?.title ?? "Hosting payout",
      subtitle: e?.subtitle ?? "",
      amount: Number(e?.amount ?? 0),
      date: e?.date ?? new Date().toISOString(),
    }));
  },
};

/** Local favorite toggle shared by both modes (favorites live on-device). */
export async function toggleLocalFavorite(id: string): Promise<boolean> {
  const favIds = await readPersisted<string[]>(STORAGE_KEYS.favorites, []);
  const set = new Set(favIds);
  const nowFav = !set.has(id);
  if (nowFav) set.add(id);
  else set.delete(id);
  await writePersisted(STORAGE_KEYS.favorites, Array.from(set));
  return nowFav;
}

export const apiServices = {
  auth: apiAuth,
  spots: apiSpots,
  bookings: apiBookings,
  host: apiHost,
  wallet: apiWallet,
  clone,
};
