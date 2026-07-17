import type { NavigatorScreenParams } from "@react-navigation/native";

export type RootStackParamList = {
  // Auth / entry stack
  Splash: undefined;
  Onboarding: undefined;
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  OtpVerification:
    | {
        phone?: string;
        name?: string;
        email?: string;
        mode?: "login" | "register";
      }
    | undefined;

  // Main tabs wrapper (accepts nested tab targets, e.g. { screen: "Bookings" })
  Main: NavigatorScreenParams<MainTabParamList> | undefined;

  // Tab primary screens (registered inside MainTabs, but typed for convenience)
  Home: undefined;
  Bookings: undefined;
  Post: undefined;
  Wallet: undefined;
  Profile: undefined;

  // Explore is no longer a tab — it's a pushed screen reachable from anywhere
  Explore: undefined;

  // Shared detail screens (registered at the main native-stack level)
  SpotDetail: { id?: string } | undefined;
  SearchResults:
    | { query?: string; latitude?: number; longitude?: number; filters?: any }
    | undefined;
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
  Chat: { bookingId: string; spotTitle?: string };
};

export type MainTabParamList = {
  Home: undefined;
  Bookings: undefined;
  Post: undefined;
  Wallet: undefined;
  Profile: undefined;
};
