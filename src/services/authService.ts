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
import { API_URL, isApiEnabled } from "@/config/apiConfig";
import { apiAuth } from "@/services/api/apiServices";
import { http } from "@/services/api/http";

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

/**
 * Confirms a saved session is still good with the server. This is what stops a
 * stale session (e.g. an APK reinstalled over an old one, or an account/token
 * that no longer exists) from silently dropping the user onto the Home tab:
 *   - "valid":   the token works (or we're in offline/demo mode) → keep the user
 *   - "invalid": the server rejected it (expired token / account gone) → the
 *                caller should sign out and show Login/Register
 *   - "unknown": couldn't tell (offline, or the free-tier server is waking up)
 *                → keep trusting the cached session; never sign out a real user
 *                over a flaky network.
 */
async function validateSession(): Promise<"valid" | "invalid" | "unknown"> {
  if (!isApiEnabled()) return "valid";
  const token = await http.getToken();
  // A session with no token can't be verified — treat as signed out.
  if (!token) return "invalid";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${API_URL}/api/me`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    // Any auth rejection (expired token, deleted account) → sign out & re-login.
    if (res.status === 401 || res.status === 403) return "invalid";
    if (res.ok) return "valid";
    // 5xx / unexpected → can't prove it's invalid, keep the user signed in.
    return "unknown";
  } catch {
    clearTimeout(timer);
    // Offline or the free-tier server is still waking up — don't sign out.
    return "unknown";
  }
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
  validateSession,
  logout,
  isOnboarded,
  setOnboarded,
};
