export type RootStackParamList = {
  // Auth / entry stack
  Splash: undefined;
  Onboarding: undefined;
  Welcome: undefined;
  Login: undefined;
  OtpVerification: { phone?: string } | undefined;

  // Main tabs wrapper
  Main: undefined;

  // Tab primary screens (registered inside MainTabs, but typed for convenience)
  Home: undefined;
  Explore: undefined;
  Bookings: undefined;
  Wallet: undefined;
  Profile: undefined;

  // Shared detail screens (registered at the main native-stack level)
  SpotDetail: { id?: string } | undefined;
  SearchResults: { query?: string; filters?: any } | undefined;
  BookingFlow: { spotId?: string } | undefined;
  BookingConfirmation: { bookingId?: string } | undefined;
  BookingDetail: { id?: string } | undefined;
  EditProfile: undefined;
  Settings: undefined;
  HelpSupport: undefined;
  About: undefined;
  TermsPrivacy: { tab?: "terms" | "privacy" } | undefined;
  Feedback: undefined;
  Reports: undefined;
  Favorites: undefined;
  Notifications: undefined;
  ListSpace: undefined;
  HostRequests: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Bookings: undefined;
  Wallet: undefined;
  Profile: undefined;
};
