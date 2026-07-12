/**
 * App-wide constants for ParkingFriend.
 * Static, non-themed values: brand strings, support contacts, and the option
 * lists used across search filters, listing creation and booking flows.
 */

export const APP_NAME = "ParkingFriend";
export const APP_TAGLINE = "Your parking friend";
export const APP_DESCRIPTION =
  "Find and book trusted home & near-station parking — or list your empty space and earn.";

export const SUPPORT_EMAIL = "help@parkingfriend.in";
export const SUPPORT_PHONE = "+91 98110 22044";
export const SUPPORT_WHATSAPP = "+91 98110 22044";
export const SUPPORT_HOURS = "Mon–Sun, 7:00 AM – 11:00 PM IST";

export const COMPANY = {
  name: "ParkingFriend Mobility Pvt. Ltd.",
  city: "Gurugram",
  state: "Haryana",
  country: "India",
  address: "Sector 44, Gurugram, Haryana 122003",
  website: "www.parkingfriend.in",
} as const;

export const CURRENCY = {
  code: "INR",
  symbol: "₹",
  locale: "en-IN",
} as const;

export const SOCIAL_LINKS = {
  instagram: "https://instagram.com/parkingfriend",
  twitter: "https://twitter.com/parkingfriend",
  facebook: "https://facebook.com/parkingfriend",
  linkedin: "https://linkedin.com/company/parkingfriend",
} as const;

/** Metro stations ParkingFriend serves in Gurugram. */
export const STATIONS = [
  "Huda City Centre",
  "IFFCO Chowk",
  "MG Road",
  "Sikanderpur",
  "Sohna Road",
  "Rajiv Chowk",
] as const;

export type Station = (typeof STATIONS)[number];

/**
 * Vehicle types a spot can accept / a driver can book for.
 * `icon` is an Ionicons name; `mci` is the MaterialCommunityIcons name for
 * screens that want a distinct motorbike/bicycle glyph.
 */
export const VEHICLE_OPTIONS = [
  { id: "car", label: "Car", icon: "car-outline", mci: "car" },
  { id: "bike", label: "Bike", icon: "bicycle-outline", mci: "motorbike" },
  { id: "bicycle", label: "Bicycle", icon: "bicycle-outline", mci: "bicycle" },
] as const;

export type VehicleOption = (typeof VEHICLE_OPTIONS)[number];
export type VehicleId = VehicleOption["id"];

/** Parking spot types shown in filters and on listing creation. */
export const SPOT_TYPE_OPTIONS = [
  { id: "home", label: "Home", icon: "home-outline" },
  { id: "driveway", label: "Driveway", icon: "car-outline" },
  { id: "garage", label: "Garage", icon: "business-outline" },
  { id: "openlot", label: "Open Lot", icon: "map-outline" },
  { id: "basement", label: "Basement", icon: "layers-outline" },
] as const;

export type SpotTypeOption = (typeof SPOT_TYPE_OPTIONS)[number];
export type SpotTypeId = SpotTypeOption["id"];

/** Amenities a host can offer; drivers filter on these. */
export const AMENITY_OPTIONS = [
  { id: "cctv", label: "CCTV", icon: "videocam-outline" },
  { id: "covered", label: "Covered", icon: "umbrella-outline" },
  { id: "ev_charging", label: "EV Charging", icon: "flash-outline" },
  { id: "security_guard", label: "Security Guard", icon: "shield-checkmark-outline" },
  { id: "gated", label: "Gated", icon: "lock-closed-outline" },
  { id: "well_lit", label: "Well Lit", icon: "bulb-outline" },
  { id: "car_wash", label: "Car Wash", icon: "water-outline" },
  { id: "24x7_access", label: "24x7 Access", icon: "time-outline" },
  { id: "wheelchair", label: "Accessible", icon: "accessibility-outline" },
  { id: "valet", label: "Valet", icon: "person-outline" },
] as const;

export type AmenityOption = (typeof AMENITY_OPTIONS)[number];
export type AmenityId = AmenityOption["id"];

/** Payment methods used in the booking + wallet flows. */
export const PAYMENT_METHODS = [
  { id: "wallet", label: "ParkingFriend Wallet", icon: "wallet-outline" },
  { id: "upi", label: "UPI", icon: "phone-portrait-outline" },
  { id: "card", label: "Credit / Debit Card", icon: "card-outline" },
  { id: "netbanking", label: "Net Banking", icon: "business-outline" },
  { id: "cash", label: "Cash on Arrival", icon: "cash-outline" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentMethodId = PaymentMethod["id"];

/** Common durations offered in the booking flow (in hours). */
export const DURATION_OPTIONS = [
  { hours: 1, label: "1 hr" },
  { hours: 2, label: "2 hrs" },
  { hours: 4, label: "4 hrs" },
  { hours: 8, label: "8 hrs" },
  { hours: 12, label: "12 hrs" },
  { hours: 24, label: "Full day" },
] as const;

/** Preset top-up amounts for the Add Money screen (INR). */
export const WALLET_TOPUP_PRESETS = [100, 200, 500, 1000, 2000] as const;

/** Categories used to group help / FAQ content. */
export const FAQ_CATEGORIES = [
  "Booking",
  "Payments",
  "Hosting",
  "Account",
  "Safety",
] as const;

/** Reasons shown when a driver cancels a booking. */
export const CANCELLATION_REASONS = [
  "Plans changed",
  "Found a better spot",
  "Booked by mistake",
  "Host unresponsive",
  "Price too high",
  "Other",
] as const;

/** Report categories used on the Reports screen. */
export const REPORT_CATEGORIES = [
  "Incorrect spot details",
  "Safety concern",
  "Host misconduct",
  "Payment issue",
  "Spot unavailable",
  "Other",
] as const;

/** AsyncStorage keys used across services (single source of truth). */
export const STORAGE_KEYS = {
  theme: "pm_theme",
  session: "pm_session",
  onboarded: "pm_onboarded",
  favorites: "pm_favorites",
  bookings: "pm_bookings",
  wallet: "pm_wallet",
  user: "pm_user",
  notifications: "pm_notifications",
  listings: "pm_listings",
} as const;

export const DEFAULT_CITY = "Gurugram";
export const OTP_LENGTH = 6;
export const APP_VERSION = "1.0.0";
