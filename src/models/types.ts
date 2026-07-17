export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  verified: boolean;
  memberSince: string;
  /** Reputation as a HOST (drivers rate hosts). */
  rating: number;
  reviewsCount?: number;
  /** Reputation as a DRIVER (hosts rate drivers). */
  driverRating?: number;
  driverRatingCount?: number;
  role: "driver" | "host" | "both";
}

export interface Host {
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  reviewsCount: number;
  verified: boolean;
  responseTime: string;
}

/** One person's pending rating for a completed parking (from /api/ratings/pending). */
export interface PendingRating {
  bookingId: string;
  /** "driver" = you rate the host; "host" = you rate the driver. */
  role: "driver" | "host";
  spotId: string;
  spotTitle: string;
  date: string;
  counterparty: {
    id: string;
    name: string;
    avatar?: string | null;
    rating: number;
    ratingCount: number;
  };
}

/** One chat message inside a booking's conversation. */
export interface ChatMessage {
  id: string;
  bookingId: string;
  senderId: string;
  text: string;
  /** ISO timestamp. */
  at: string;
}

/** One live chat's latest state (from the summary poll, drives notifications). */
export interface ChatSummary {
  bookingId: string;
  spotTitle: string;
  lastText: string;
  lastAt: string;
  lastFrom: string;
  lastFromName: string;
}

/** A booking's chat thread: who you're talking to + whether it's still open. */
export interface ChatThread {
  /** False once the parking completed/cancelled — chat closed & wiped. */
  open: boolean;
  with: { name: string; avatar?: string | null };
  messages: ChatMessage[];
}

/** A public review left on a spot (driver → host). */
export interface SpotReview {
  id: string;
  stars: number;
  comment: string;
  createdAt: string;
  raterName: string;
  raterAvatar?: string | null;
}

/** Vehicle kinds a space can hold. "suv" is legacy — new listings use car/bike/bicycle. */
export type VehicleType = "car" | "bike" | "bicycle" | "suv";

export interface ParkingSpot {
  id: string;
  title: string;
  hostId: string;
  host: Host;
  type: "home" | "driveway" | "garage" | "openlot" | "basement";
  vehicleTypes: VehicleType[];
  /** How many vehicles fit in this space (host sets it when listing). */
  capacity: number;
  /** capacity minus currently accepted bookings — what's actually left right now. */
  remainingCount: number;
  /** How many times drivers have opened this listing (host-facing interest metric). */
  views: number;
  address: string;
  area: string;
  city: string;
  landmark: string;
  nearStation: string;
  distanceMeters: number;
  latitude: number;
  longitude: number;
  pricePerHour: number;
  pricePerDay: number;
  isFree: boolean;
  rating: number;
  reviewsCount: number;
  images: string[];
  amenities: string[];
  availableFrom: string;
  availableTo: string;
  instructions: string;
  isFavorite: boolean;
  available: boolean;
  /** True when the space is open every day (no fixed calendar window). */
  availableAlways: boolean;
  /** First day the space is open (YYYY-MM-DD) — only when availableAlways is false. */
  availableStartDate?: string | null;
  /** Last day the space is open (YYYY-MM-DD) — only when availableAlways is false. */
  availableEndDate?: string | null;
  /**
   * Server-computed availability state (in the server's timezone), so the app
   * shows the right "why closed" reason without guessing from the device clock.
   * open = bookable; upcoming = window hasn't started; ended = window passed;
   * off = switched off. Absent in demo mode (the app derives it locally).
   */
  availabilityState?: "open" | "upcoming" | "ended" | "off";
}

export interface Booking {
  id: string;
  spotId: string;
  spot: ParkingSpot;
  userId: string;
  vehicleType: string;
  vehicleNumber: string;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  amount: number;
  status: "pending" | "confirmed" | "active" | "completed" | "cancelled";
  /** Legacy field — the app no longer processes payments; kept optional for old data. */
  paymentMethod?: string;
  createdAt: string;
  contactUnlocked: boolean;
  otp?: string;
  /** Host's phone number — revealed ONLY after the host accepts the request. */
  hostPhone?: string | null;
  /** Why the driver cancelled (a picked preset or free text), when cancelled. */
  cancelReason?: string;
  /** True once accepted AND the parking date has passed — both sides may rate. */
  completed?: boolean;
}

export interface Transaction {
  id: string;
  type: "credit" | "debit";
  title: string;
  amount: number;
  date: string;
  method: string;
  status: "success" | "pending" | "failed";
}

export interface WalletInfo {
  balance: number;
  currency: string;
  transactions: Transaction[];
}

/**
 * A single completed-parking record used to compute savings (as a driver)
 * and profit (as a host). The app does not move money — these are just tallies.
 */
export interface EarningEntry {
  id: string;
  /** "saving" = money you saved parking cheaply; "earning" = profit you made hosting. */
  kind: "saving" | "earning";
  title: string;
  subtitle: string;
  amount: number;
  date: string;
}

export interface WalletSummary {
  savingsLast3Months: number;
  savingsLifetime: number;
  earningsLast3Months: number;
  earningsLifetime: number;
  completedAsDriver: number;
  completedAsHost: number;
}

export interface Coupon {
  id: string;
  code: string;
  title: string;
  description: string;
  discount: number;
  kind: "flat" | "percent";
  minAmount: number;
  expiry: string;
  color: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: "booking" | "offer" | "system" | "host";
  read: boolean;
  icon: string;
}

export interface Review {
  id: string;
  userName: string;
  avatar?: string;
  rating: number;
  comment: string;
  date: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export interface OnboardingSlide {
  id: string;
  title: string;
  subtitle: string;
  illustration: string;
}

export interface HostRequest {
  id: string;
  spotTitle: string;
  requesterId?: string;
  requesterName: string;
  requesterAvatar?: string;
  /** Requester's phone — so the host can also reach out after accepting. */
  requesterPhone?: string;
  /** The requester's rating AS A DRIVER, shown to the host before accepting. */
  requesterRating?: number;
  requesterRatingCount?: number;
  vehicleType: string;
  date: string;
  time: string;
  /** "cancelled" = the DRIVER withdrew (vs "declined" = the host said no). */
  status: "pending" | "accepted" | "declined" | "cancelled";
  /** Links back to the driver's booking so accept/decline updates it. */
  bookingId?: string;
  /** Last day of the parking (multi-day bookings) — from the linked booking. */
  endDate?: string;
}
