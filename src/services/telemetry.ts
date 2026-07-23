import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { API_URL, isApiEnabled } from "@/config/apiConfig";
import { getToken } from "@/services/api/http";

/**
 * First-party telemetry — the app half of the analytics/error pipeline.
 *
 * ⚠️ THIS FILE SHIPS INSIDE APKs AND ITS SERVER CONTRACT IS FROZEN:
 * batched POSTs of generic {id, name, props} events to /api/telemetry/events
 * and error reports to /api/telemetry/errors. Every metric, dashboard and
 * query lives SERVER-side — new analytics never require an app update.
 *
 * Design rules (all non-negotiable for something baked into installed apps):
 *   - FAIL-SILENT: no code path here may ever throw into the app, block the
 *     UI, or show anything to the user. Telemetry breaking = nothing happens.
 *   - OFFLINE-SAFE: events queue in AsyncStorage and survive app kills;
 *     retries back off; the queue is hard-capped so it can never grow forever.
 *   - IDEMPOTENT: every event carries a client-generated id; the server does
 *     INSERT OR IGNORE, so a retried batch can never double-count.
 *   - KILL-SWITCH: a 410 response disables sending for the rest of the
 *     session (server can turn the firehose off without an app update).
 *   - PRIVATE BY DESIGN: no message contents, phone numbers or addresses are
 *     ever sent — just event names, screen names and tiny numeric props.
 */

const QUEUE_KEY = "pm_tel_queue_v1";
const ANON_KEY = "pm_tel_anon_v1";
const ERRORS_KEY = "pm_tel_errors_v1";

const MAX_QUEUE = 500;
const MAX_ERROR_QUEUE = 20;
const BATCH_SIZE = 25;
const FLUSH_INTERVAL_MS = 30000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;
const SESSION_GAP_MS = 30 * 60 * 1000;
const NAME_RE = /^[a-z0-9_.:-]{1,64}$/i;

interface QueuedEvent {
  id: string;
  name: string;
  props?: Record<string, unknown>;
  at: string;
  sessionId: string;
}

interface QueuedError {
  id: string;
  message: string;
  stack?: string;
  fatal?: boolean;
  screen?: string;
  at: string;
  sessionId: string;
}

let queue: QueuedEvent[] = [];
let errorQueue: QueuedError[] = [];
let anonId: string | null = null;
let sessionId = "";
let lastActivityAt = 0;
let currentScreen: string | null = null;
let lastTrackedScreen: string | null = null;
let disabled = false; // set by the 410 kill-switch, per session
let loaded: Promise<void> | null = null;
let initialized = false; // init() may be re-entered on Android activity recreation
let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushing = false;
let backoffMs = 0;
let backoffUntil = 0;

function genId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function device() {
  return {
    appVersion: (Constants as any)?.expoConfig?.version ?? "0",
    platform: Platform.OS,
    osVersion: String(Platform.Version ?? ""),
    model: (Constants as any)?.deviceName ?? null,
  };
}

/** Session = continuous usage; a 30-min gap starts a new one. */
function touchSession(): void {
  const now = Date.now();
  if (!sessionId || now - lastActivityAt > SESSION_GAP_MS) {
    sessionId = genId();
  }
  lastActivityAt = now;
}

/** One-time lazy bootstrap: anon device id + any queue persisted before a kill. */
function ensureLoaded(): Promise<void> {
  if (!loaded) {
    loaded = (async () => {
      try {
        anonId = await AsyncStorage.getItem(ANON_KEY);
        if (!anonId) {
          anonId = genId();
          await AsyncStorage.setItem(ANON_KEY, anonId);
        }
      } catch {
        anonId = anonId ?? genId(); // memory-only fallback
      }
      try {
        const raw = await AsyncStorage.getItem(QUEUE_KEY);
        const saved = raw ? (JSON.parse(raw) as QueuedEvent[]) : [];
        if (Array.isArray(saved) && saved.length) {
          queue = [...saved, ...queue].slice(-MAX_QUEUE);
        }
      } catch {
        /* corrupted queue = start fresh */
      }
      try {
        const raw = await AsyncStorage.getItem(ERRORS_KEY);
        const saved = raw ? (JSON.parse(raw) as QueuedError[]) : [];
        if (Array.isArray(saved) && saved.length) {
          errorQueue = [...saved, ...errorQueue].slice(-MAX_ERROR_QUEUE);
        }
      } catch {
        /* ignore */
      }
    })().catch(() => {});
  }
  return loaded;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persistSoon(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    // try/catch around the WHOLE body: this runs in a bare timer callback
    // where a throw (e.g. an unserializable prop) would surface as an app
    // error — the one thing telemetry must never cause.
    try {
      AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE))).catch(() => {});
      AsyncStorage.setItem(ERRORS_KEY, JSON.stringify(errorQueue.slice(-MAX_ERROR_QUEUE))).catch(
        () => {}
      );
    } catch {
      /* fail-silent, always */
    }
  }, 1500);
}

async function post(path: string, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = await getToken().catch(() => null);
    if (token) headers.Authorization = `Bearer ${token}`;
    return await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Permanently-bad payload → drop. 429 is NOT that: it's load-shedding and the
 *  data must survive to retry later (shared-IP networks WILL 429 sometimes). */
function isDroppable4xx(status: number): boolean {
  return status >= 400 && status < 500 && status !== 429;
}

async function flush(): Promise<void> {
  if (flushing || disabled || !isApiEnabled()) return;
  if (Date.now() < backoffUntil) return;
  // Set the guard BEFORE any await — otherwise two callers both pass the
  // check while ensureLoaded is pending and double-POST the same batch.
  flushing = true;
  try {
    await ensureLoaded();
    if (queue.length === 0 && errorQueue.length === 0) return;
    if (errorQueue.length > 0) {
      const batch = errorQueue.slice(0, 10);
      const res = await post("/api/telemetry/errors", {
        anonId,
        device: device(),
        errors: batch,
      });
      if (res.status === 410) {
        disabled = true;
        return;
      }
      if (res.ok) {
        const sent = new Set(batch.map((e) => e.id));
        errorQueue = errorQueue.filter((e) => !sent.has(e.id));
        persistSoon();
        backoffMs = 0;
      } else if (isDroppable4xx(res.status)) {
        // The server rejected the batch outright — drop it (retrying forever
        // on a permanently-bad payload would wedge the queue).
        errorQueue = errorQueue.slice(batch.length);
        persistSoon();
      } else {
        throw new Error(`status ${res.status}`); // 5xx/429 → backoff, retry later
      }
    }
    if (queue.length > 0) {
      const batch = queue.slice(0, BATCH_SIZE);
      const res = await post("/api/telemetry/events", {
        anonId,
        device: device(),
        events: batch,
      });
      if (res.status === 410) {
        disabled = true;
        return;
      }
      if (res.ok) {
        const sent = new Set(batch.map((e) => e.id));
        queue = queue.filter((e) => !sent.has(e.id));
        persistSoon();
        backoffMs = 0;
        // Backlog left? Drain with a RANDOMIZED delay — after an outage every
        // device holds a backlog, and synchronized rapid drains from a shared
        // IP (hospital WiFi / carrier CGNAT) would trip the server's limiter.
        if (queue.length >= BATCH_SIZE) {
          setTimeout(() => void flush(), 2000 + Math.floor(Math.random() * 4000));
        }
      } else if (isDroppable4xx(res.status)) {
        queue = queue.slice(batch.length);
        persistSoon();
      } else {
        throw new Error(`status ${res.status}`);
      }
    }
  } catch {
    // Network/server hiccup: keep the queue, back off (30s → 1m → ... → 5m).
    backoffMs = Math.min(MAX_BACKOFF_MS, backoffMs > 0 ? backoffMs * 2 : FLUSH_INTERVAL_MS);
    backoffUntil = Date.now() + backoffMs;
  } finally {
    flushing = false;
  }
}

/** Records an analytics event. Safe to call from anywhere, any time. */
function track(name: string, props?: Record<string, unknown>): void {
  try {
    if (disabled || !isApiEnabled() || !NAME_RE.test(name)) return;
    touchSession();
    queue.push({
      id: genId(),
      name: name.toLowerCase(),
      props: props && Object.keys(props).length ? props : undefined,
      at: nowIso(),
      sessionId,
    });
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    void ensureLoaded();
    persistSoon();
  } catch {
    /* fail-silent, always */
  }
}

/** Screen views (auto-called from the navigation container). */
function screen(name: string): void {
  try {
    currentScreen = name;
    if (name === lastTrackedScreen) return; // tab re-taps aren't new views
    lastTrackedScreen = name;
    track("screen_view", { screen: name });
  } catch {
    /* ignore */
  }
}

/**
 * Records an app error/crash. `fatal` = the global handler caught an
 * unrecoverable throw. Flushes immediately (best-effort) because a fatal
 * error may be the process's last breath — the persisted queue is the
 * fallback that survives into the next launch.
 */
function captureError(message: unknown, stack?: string, fatal?: boolean): void {
  try {
    if (disabled || !isApiEnabled()) return;
    touchSession();
    const msg = String(
      (message as any)?.message ?? message ?? "Unknown error"
    ).slice(0, 500);
    errorQueue.push({
      id: genId(),
      message: msg,
      stack: typeof stack === "string" ? stack.slice(0, 8000) : undefined,
      fatal: !!fatal,
      screen: currentScreen ?? undefined,
      at: nowIso(),
      sessionId,
    });
    if (errorQueue.length > MAX_ERROR_QUEUE) errorQueue = errorQueue.slice(-MAX_ERROR_QUEUE);
    // Persist promptly (not debounced) — a crash may kill the process — but
    // ONLY after ensureLoaded has merged the PREVIOUS session's persisted
    // errors, or an early startup crash would overwrite (and lose) them.
    // ensureLoaded resolves in ms; the in-memory push above is already done.
    void ensureLoaded()
      .then(() => {
        AsyncStorage.setItem(
          ERRORS_KEY,
          JSON.stringify(errorQueue.slice(-MAX_ERROR_QUEUE))
        ).catch(() => {});
        void flush();
      })
      .catch(() => {});
  } catch {
    /* fail-silent, always */
  }
}

/** Push everything out now (used on app-background and logout). */
function flushNow(): void {
  void flush();
}

/**
 * Boot the pipeline: restore queues, start the flush loop, emit app_open,
 * and follow foreground/background transitions. Call once from App.tsx.
 */
function init(): void {
  try {
    // Once-guard: on Android the JS context can outlive the Activity, so App
    // remounts re-run this — without the guard every remount would stack
    // another AppState listener (N× duplicate events) and a bogus app_open.
    if (initialized || !isApiEnabled()) return;
    initialized = true;
    void ensureLoaded().then(() => {
      touchSession();
      track("app_open");
      void flush();
    });
    if (!flushTimer) {
      flushTimer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    }
    AppState.addEventListener("change", (state) => {
      if (state === "active") {
        const wasStale = Date.now() - lastActivityAt > SESSION_GAP_MS;
        touchSession();
        if (wasStale) {
          track("app_open");
          // New session: re-emit the landing screen under the new sessionId
          // (the consecutive-screen dedupe would otherwise swallow it).
          lastTrackedScreen = null;
          if (currentScreen) screen(currentScreen);
        }
        void flush();
      } else if (state === "background") {
        // ONLY "background" counts: iOS fires active→inactive→background (two
        // events per real backgrounding), and 'inactive' alone also fires for
        // Control Center pulls / call banners that never leave the app.
        track("app_background");
        void flush(); // best-effort before the OS freezes us
      } else if (state === "inactive") {
        void flush(); // iOS pre-background blip — flush early, don't count
      }
    });
  } catch {
    /* fail-silent, always */
  }
}

export const telemetry = {
  init,
  track,
  screen,
  captureError,
  flushNow,
};
