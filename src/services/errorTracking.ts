import { telemetry } from "@/services/telemetry";

/**
 * Global JS error capture — the "how many users hit an error, and where"
 * pipeline. Hooks React Native's global error handler (which sees every
 * uncaught throw, fatal or not), reports it via telemetry, then hands the
 * error to the previous handler so RN's own behavior (dev red-box, release
 * recovery) is untouched.
 *
 * Baked into shipped APKs — keep it tiny and impossible to break. If a crash
 * reporter service (e.g. Sentry) is added later, it slots in HERE without
 * touching anything else.
 */

let installed = false;

function setup(): void {
  if (installed) return;
  installed = true;
  try {
    const ErrorUtils = (globalThis as any).ErrorUtils;
    if (ErrorUtils?.setGlobalHandler) {
      const previous = ErrorUtils.getGlobalHandler?.();
      ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
        try {
          telemetry.captureError(error, (error as any)?.stack, !!isFatal);
        } catch {
          /* the reporter must never make a crash worse */
        }
        if (typeof previous === "function") previous(error, isFatal);
      });
    }
  } catch {
    /* fail-silent */
  }
}

export const errorTracking = { setup };
