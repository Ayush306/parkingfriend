import type { User } from "@/models/types";
import currentUser from "@/data/currentUser.json";
import {
  delay,
  randomLatency,
  removePersisted,
  STORAGE_KEYS,
  writePersisted,
  clone,
} from "@/services/mockClient";
import AsyncStorage from "@react-native-async-storage/async-storage";

const seedUser = currentUser as User;

export interface SendOtpResult {
  success: boolean;
  message: string;
}

export interface VerifyOtpResult {
  success: boolean;
  user: User;
  message: string;
}

/** Simulates sending an OTP to the given phone number. */
async function sendOtp(phone: string): Promise<SendOtpResult> {
  await delay(randomLatency());
  return {
    success: true,
    message: `We've sent a 6-digit code to ${phone.trim()}`,
  };
}

/**
 * Verifies an OTP. Accepts "123456", "1234", or any 6-digit numeric code as
 * valid. On success returns the seeded current user and saves the session.
 */
async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  await delay(randomLatency());
  const trimmed = (code ?? "").trim();
  const isValid =
    trimmed === "123456" ||
    trimmed === "1234" ||
    /^\d{6}$/.test(trimmed);

  if (!isValid) {
    throw new Error("Invalid code. Please check and try again.");
  }

  const user: User = { ...clone(seedUser), phone: phone.trim() || seedUser.phone };
  await saveSession(user);
  return {
    success: true,
    user,
    message: "Verified successfully",
  };
}

/** Returns the currently saved session user, or null if signed out. */
async function getSession(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.session);
    if (raw != null) return JSON.parse(raw) as User;
  } catch {
    // Ignore and treat as signed-out.
  }
  return null;
}

/** Persists the signed-in user session. */
async function saveSession(user: User): Promise<void> {
  await writePersisted(STORAGE_KEYS.session, user);
}

/** Clears the saved session (sign out). */
async function logout(): Promise<void> {
  await removePersisted(STORAGE_KEYS.session);
}

/** Whether the user has completed onboarding at least once. */
async function isOnboarded(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.onboarded);
    return raw === "true";
  } catch {
    return false;
  }
}

/** Marks onboarding as completed. */
async function setOnboarded(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.onboarded, "true");
  } catch {
    // Ignore write failures.
  }
}

export const authService = {
  sendOtp,
  verifyOtp,
  getSession,
  saveSession,
  logout,
  isOnboarded,
  setOnboarded,
};
