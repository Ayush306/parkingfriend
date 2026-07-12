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
import { isApiEnabled } from "@/config/apiConfig";
import { apiAuth } from "@/services/api/apiServices";

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

/** Sends an OTP to the given phone number (real API when configured). */
async function sendOtp(phone: string): Promise<SendOtpResult> {
  if (isApiEnabled()) {
    return apiAuth.sendOtp(phone);
  }
  await delay(randomLatency());
  return {
    success: true,
    message: `We've sent a 6-digit code to ${phone.trim()}`,
  };
}

/**
 * Verifies an OTP. On success saves the session and returns the user.
 * `extra.name` present = REGISTER (creates the account); absent = LOGIN
 * (which the server rejects for an unknown number). In offline/demo mode
 * any 6-digit code works and the name/email are folded into the local user.
 */
async function verifyOtp(
  phone: string,
  code: string,
  extra?: { name?: string; email?: string }
): Promise<VerifyOtpResult> {
  if (isApiEnabled()) {
    const result = await apiAuth.verifyOtp(phone, code, extra);
    await saveSession(result.user);
    return result;
  }
  await delay(randomLatency());
  const trimmed = (code ?? "").trim();
  const isValid =
    trimmed === "123456" ||
    trimmed === "1234" ||
    /^\d{6}$/.test(trimmed);

  if (!isValid) {
    throw new Error("Invalid code. Please check and try again.");
  }

  const user: User = {
    ...clone(seedUser),
    phone: phone.trim() || seedUser.phone,
    ...(extra?.name ? { name: extra.name } : {}),
    ...(extra?.email ? { email: extra.email } : {}),
  };
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

/** Clears the saved session (sign out) and any API token. */
async function logout(): Promise<void> {
  await removePersisted(STORAGE_KEYS.session);
  await apiAuth.logout().catch(() => {});
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
