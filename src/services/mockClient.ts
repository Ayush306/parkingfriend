import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Resolves after the given number of milliseconds.
 * Used to simulate network latency across all mock services.
 */
export function delay(ms: number = 800): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns a random latency in a realistic 500-950ms band so that
 * loading states are visible but the app never feels sluggish.
 */
export function randomLatency(): number {
  return 500 + Math.floor(Math.random() * 450);
}

export interface SimulateOptions {
  /** Fixed latency in ms. When omitted a random 500-950ms delay is used. */
  ms?: number;
  /**
   * Probability [0..1] that the call rejects with a generic error.
   * DEFAULT is 0 so happy paths never randomly fail.
   */
  failRate?: number;
}

/**
 * Simulates an async network call: resolves with `data` after a delay,
 * or rejects with a generic Error with probability `failRate`.
 * A deep clone of the data is returned so callers can safely mutate it
 * without corrupting the seeded JSON in memory.
 */
export async function simulate<T>(data: T, opts: SimulateOptions = {}): Promise<T> {
  const { ms, failRate = 0 } = opts;
  await delay(ms ?? randomLatency());
  if (failRate > 0 && Math.random() < failRate) {
    throw new Error("Something went wrong. Please try again.");
  }
  return clone(data);
}

/** Deep clone helper that is safe for our plain-JSON data shapes. */
export function clone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Reads a value from AsyncStorage, seeding it from `seed` (and persisting
 * that seed) the first time it is accessed. Guarantees callers always get a
 * fresh, independent copy of the data.
 */
export async function readPersisted<T>(key: string, seed: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw != null) {
      return JSON.parse(raw) as T;
    }
  } catch {
    // Corrupt/unavailable storage -> fall back to seed below.
  }
  const seeded = clone(seed);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(seeded));
  } catch {
    // Ignore write failures; we still return the seed in memory.
  }
  return seeded;
}

/** Writes a value to AsyncStorage, swallowing storage errors. */
export async function writePersisted<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore write failures in the mock environment.
  }
}

/** Removes a persisted key, swallowing storage errors. */
export async function removePersisted(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

/** Generates a short unique id with an optional prefix. */
export function genId(prefix: string = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** Central place for all AsyncStorage keys used by the app. */
export const STORAGE_KEYS = {
  theme: "pm_theme",
  session: "pm_session",
  onboarded: "pm_onboarded",
  favorites: "pm_favorites",
  bookings: "pm_bookings",
  wallet: "pm_wallet",
  earnings: "pm_earnings",
  notifications: "pm_notifications",
  user: "pm_user",
  listings: "pm_listings",
  requests: "pm_requests",
} as const;
