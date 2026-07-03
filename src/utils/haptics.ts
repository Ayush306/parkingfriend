/**
 * Thin, crash-safe wrappers over expo-haptics. Every call is best-effort:
 * failures (unsupported platform/web, missing permission) are swallowed so
 * that UI interactions never throw because of haptics.
 */

import * as Haptics from "expo-haptics";

/** Light impact — use for taps on buttons, chips and cards. */
export function hapticLight(): void {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // no-op on failure
  }
}

/** Medium impact — use for more significant presses (e.g. confirm actions). */
export function hapticMedium(): void {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // no-op on failure
  }
}

/** Heavy impact — use sparingly for high-emphasis interactions. */
export function hapticHeavy(): void {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    // no-op on failure
  }
}

/** Success notification — booking confirmed, payment done, etc. */
export function hapticSuccess(): void {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // no-op on failure
  }
}

/** Warning notification — recoverable issues or cautions. */
export function hapticWarning(): void {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // no-op on failure
  }
}

/** Error notification — failed actions. */
export function hapticError(): void {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // no-op on failure
  }
}

/** Selection tick — use for segmented controls, toggles and pickers. */
export function hapticSelection(): void {
  try {
    void Haptics.selectionAsync();
  } catch {
    // no-op on failure
  }
}

/** Grouped export for convenient importing: `import { haptics } from ...`. */
export const haptics = {
  light: hapticLight,
  medium: hapticMedium,
  heavy: hapticHeavy,
  success: hapticSuccess,
  warning: hapticWarning,
  error: hapticError,
  selection: hapticSelection,
};

export default haptics;
