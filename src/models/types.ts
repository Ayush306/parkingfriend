export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  verified: boolean;
  memberSince: string;
  rating: number;
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
  requesterName: string;
  requesterAvatar?: string;
  /** Requester's phone — so the host can also reach out after accepting. */
  requesterPhone?: string;
  vehicleType: string;
  date: string;
  time: string;
  status: "pending" | "accepted" | "declined";
  /** Links back to the driver's booking so accept/decline updates it. */
  bookingId?: string;
}
