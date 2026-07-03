import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { RootStackParamList } from "@/navigation/types";
import MainTabs from "@/navigation/MainTabs";

// Auth / entry screens
import Splash from "@/screens/Splash/Splash";
import Onboarding from "@/screens/Onboarding/Onboarding";
import Welcome from "@/screens/Welcome/Welcome";
import Login from "@/screens/Login/Login";
import OtpVerification from "@/screens/OtpVerification/OtpVerification";

// Shared detail screens (reachable from anywhere)
import SpotDetail from "@/screens/SpotDetail/SpotDetail";
import SearchResults from "@/screens/SearchResults/SearchResults";
import BookingFlow from "@/screens/BookingFlow/BookingFlow";
import BookingConfirmation from "@/screens/BookingConfirmation/BookingConfirmation";
import BookingDetail from "@/screens/BookingDetail/BookingDetail";
import EditProfile from "@/screens/EditProfile/EditProfile";
import Settings from "@/screens/Settings/Settings";
import HelpSupport from "@/screens/HelpSupport/HelpSupport";
import About from "@/screens/About/About";
import TermsPrivacy from "@/screens/TermsPrivacy/TermsPrivacy";
import Feedback from "@/screens/Feedback/Feedback";
import Reports from "@/screens/Reports/Reports";
import Favorites from "@/screens/Favorites/Favorites";
import Notifications from "@/screens/Notifications/Notifications";
import ListSpace from "@/screens/ListSpace/ListSpace";
import HostRequests from "@/screens/HostRequests/HostRequests";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: "transparent" },
      }}
    >
      {/* Entry / auth flow */}
      <Stack.Screen
        name="Splash"
        component={Splash}
        options={{ animation: "fade" }}
      />
      <Stack.Screen
        name="Onboarding"
        component={Onboarding}
        options={{ animation: "fade" }}
      />
      <Stack.Screen name="Welcome" component={Welcome} />
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="OtpVerification" component={OtpVerification} />

      {/* Main app (tabs) */}
      <Stack.Screen
        name="Main"
        component={MainTabs}
        options={{ animation: "fade", gestureEnabled: false }}
      />

      {/* Shared detail screens — navigable from any tab/screen */}
      <Stack.Screen name="SpotDetail" component={SpotDetail} />
      <Stack.Screen name="SearchResults" component={SearchResults} />
      <Stack.Screen name="BookingFlow" component={BookingFlow} />
      <Stack.Screen
        name="BookingConfirmation"
        component={BookingConfirmation}
        options={{ gestureEnabled: false, animation: "fade" }}
      />
      <Stack.Screen name="BookingDetail" component={BookingDetail} />
      <Stack.Screen name="EditProfile" component={EditProfile} />
      <Stack.Screen name="Settings" component={Settings} />
      <Stack.Screen name="HelpSupport" component={HelpSupport} />
      <Stack.Screen name="About" component={About} />
      <Stack.Screen name="TermsPrivacy" component={TermsPrivacy} />
      <Stack.Screen name="Feedback" component={Feedback} />
      <Stack.Screen name="Reports" component={Reports} />
      <Stack.Screen name="Favorites" component={Favorites} />
      <Stack.Screen name="Notifications" component={Notifications} />
      <Stack.Screen name="ListSpace" component={ListSpace} />
      <Stack.Screen name="HostRequests" component={HostRequests} />
    </Stack.Navigator>
  );
}

export default RootNavigator;
