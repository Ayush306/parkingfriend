/**
 * Minimal HTTP client for the Parkmitter API.
 * JSON in/out, Bearer-token auth, 15s timeout, readable error messages.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "@/config/apiConfig";

const TOKEN_KEY = "pm_api_token";

let cachedToken: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  try {
    cachedToken = await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

export async function setToken(token: string | null): Promise<void> {
  cachedToken = token;
  try {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage failures shouldn't break auth flow; token stays cached in memory.
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Attach the Bearer token (default true). */
  auth?: boolean;
  timeoutMs?: number;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, timeoutMs = 15000 } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === "AbortError") {
      throw new Error("The server took too long to respond. Please try again.");
    }
    throw new Error("Can't reach the Parkmitter server. Check your connection.");
  }
  clearTimeout(timer);

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON response body; fall through to status handling.
  }

  if (!res.ok) {
    const message =
      (json && typeof json.error === "string" && json.error) ||
      (res.status === 401
        ? "Please sign in again."
        : `Request failed (${res.status}).`);
    throw new Error(message);
  }
  return json as T;
}

export const http = { request, getToken, setToken };
