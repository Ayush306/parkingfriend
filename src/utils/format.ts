/**
 * Formatting helpers for Parkmitter. All currency uses the Indian rupee with
 * en-IN grouping (₹1,23,456). Dates/times are rendered in a friendly,
 * India-appropriate style.
 */

const RUPEE = "₹";

/**
 * Format a number as INR, e.g. 1234 -> "₹1,234", 150000 -> "₹1,50,000".
 * Non-finite values render as "₹0". Decimals are dropped by default; pass
 * withDecimals to keep two decimal places (e.g. wallet balances).
 */
export function formatCurrency(
  amount: number | null | undefined,
  opts: { withDecimals?: boolean } = {}
): string {
  const value = typeof amount === "number" && isFinite(amount) ? amount : 0;
  const { withDecimals = false } = opts;

  const formatted = value.toLocaleString("en-IN", {
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: withDecimals ? 2 : 0,
  });

  return `${RUPEE}${formatted}`;
}

/** Same as formatCurrency but renders "Free" when the amount is 0. */
export function formatPrice(
  amount: number | null | undefined,
  opts: { free?: boolean; withDecimals?: boolean } = {}
): string {
  const value = typeof amount === "number" && isFinite(amount) ? amount : 0;
  if (opts.free && value === 0) return "Free";
  return formatCurrency(value, { withDecimals: opts.withDecimals });
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDate(input: string | number | Date | null | undefined): Date | null {
  if (input == null) return null;
  const d = input instanceof Date ? input : new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a date, e.g. "12 Aug 2026". Pass withWeekday for "Wed, 12 Aug 2026".
 * Returns an empty string for invalid input.
 */
export function formatDate(
  input: string | number | Date | null | undefined,
  opts: { withWeekday?: boolean; withYear?: boolean } = {}
): string {
  const d = toDate(input);
  if (!d) return "";
  const { withWeekday = false, withYear = true } = opts;

  const day = d.getDate();
  const month = MONTHS_SHORT[d.getMonth()];
  const year = d.getFullYear();

  let base = `${day} ${month}`;
  if (withYear) base += ` ${year}`;
  if (withWeekday) base = `${DAYS_SHORT[d.getDay()]}, ${base}`;
  return base;
}

/**
 * Format a time as 12-hour with meridiem, e.g. "9:05 AM", "6:30 PM".
 * Accepts a Date, timestamp, ISO string, or an "HH:mm" / "HH:mm:ss" string.
 */
export function formatTime(
  input: string | number | Date | null | undefined
): string {
  let hours: number;
  let minutes: number;

  if (typeof input === "string" && /^\d{1,2}:\d{2}(:\d{2})?$/.test(input.trim())) {
    const [h, m] = input.trim().split(":");
    hours = parseInt(h, 10);
    minutes = parseInt(m, 10);
  } else {
    const d = toDate(input);
    if (!d) return "";
    hours = d.getHours();
    minutes = d.getMinutes();
  }

  if (isNaN(hours) || isNaN(minutes)) return "";

  const meridiem = hours >= 12 ? "PM" : "AM";
  let hour12 = hours % 12;
  if (hour12 === 0) hour12 = 12;
  const mm = minutes.toString().padStart(2, "0");
  return `${hour12}:${mm} ${meridiem}`;
}

/**
 * Combined date + time, e.g. "12 Aug 2026 · 6:30 PM".
 */
export function formatDateTime(
  input: string | number | Date | null | undefined
): string {
  const d = toDate(input);
  if (!d) return "";
  return `${formatDate(d)} · ${formatTime(d)}`;
}

/**
 * Human-friendly distance from metres.
 * < 1000 m -> "450 m"; otherwise kilometres with one decimal -> "1.2 km".
 */
export function formatDistance(meters: number | null | undefined): string {
  const value = typeof meters === "number" && isFinite(meters) ? meters : 0;
  if (value < 1000) {
    return `${Math.round(value)} m`;
  }
  const km = value / 1000;
  const rounded = Math.round(km * 10) / 10;
  // Drop the trailing ".0" for whole kilometres.
  const label = Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
  return `${label} km`;
}

/**
 * Format a duration in hours as a compact label.
 * 1 -> "1 hr", 4 -> "4 hrs", 24 -> "1 day", 26 -> "1 day 2 hrs".
 */
export function formatDuration(hours: number | null | undefined): string {
  const total = typeof hours === "number" && isFinite(hours) ? hours : 0;
  if (total <= 0) return "0 hrs";
  const days = Math.floor(total / 24);
  const rem = total % 24;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  if (rem > 0) parts.push(`${rem} ${rem === 1 ? "hr" : "hrs"}`);
  return parts.join(" ");
}

/**
 * Compact relative time from a date, e.g. "Just now", "5m ago", "3h ago",
 * "2d ago". Falls back to formatDate for anything older than a week.
 */
export function formatRelativeTime(
  input: string | number | Date | null | undefined
): string {
  const d = toDate(input);
  if (!d) return "";
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 45) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(d);
}

/**
 * Rating to one decimal place, e.g. 4 -> "4.0", 4.35 -> "4.4".
 */
export function formatRating(value: number | null | undefined): string {
  const v = typeof value === "number" && isFinite(value) ? value : 0;
  return v.toFixed(1);
}

/**
 * Compact count for review/rating badges, e.g. 950 -> "950", 1500 -> "1.5k".
 */
export function formatCount(value: number | null | undefined): string {
  const v = typeof value === "number" && isFinite(value) ? value : 0;
  if (v < 1000) return `${v}`;
  const k = v / 1000;
  const rounded = Math.round(k * 10) / 10;
  const label = Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
  return `${label}k`;
}
