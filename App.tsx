import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";

import { pushService, type PushData } from "@/services/pushService";
import type { RootStackParamList } from "@/navigation/types";
import {
  useFonts,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";

import { ThemeProvider } from "@/theme/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { RootNavigator } from "@/navigation/RootNavigator";

// Keep the native splash screen visible while we load fonts and resources.
// Wrapped in a try/catch so a rejected promise never crashes the app.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might trigger some race conditions, ignore them */
});

/**
 * Notification-tap deep links. Tapping a phone-panel notification opens the
 * screen where the user can ACT on it:
 *   host_request   → Booking requests (accept/decline right there)
 *   booking_update → Bookings tab (accepted/declined state + host's number)
 *   rate           → Bookings tab (the Rate prompt lives at the top)
 * If the tap arrives before navigation is ready (cold start), it's queued and
 * replayed the moment the container mounts.
 */
const navigationRef = createNavigationContainerRef<RootStackParamList>();
let pendingTap: PushData | null = null;

function handleNotificationTap(data: PushData, attempt = 0) {
  if (!navigationRef.isReady()) {
    pendingTap = data;
    return;
  }
  // On a cold start the app boots through Splash (which then resets to Main
  // or Welcome). Navigating during that window would be thrown away — wait
  // until the reset has landed. If the user ends up signed out (Welcome),
  // drop the tap: they must log in first anyway.
  const current = navigationRef.getCurrentRoute()?.name;
  if (current === "Splash" || current === "Onboarding") {
    if (attempt < 12) {
      setTimeout(() => handleNotificationTap(data, attempt + 1), 700);
    }
    return;
  }
  if (current === "Welcome" || current === "Login" || current === "Register" || current === "OtpVerification") {
    return;
  }
  if (data.type === "host_request") {
    navigationRef.navigate("HostRequests");
  } else if (data.type === "chat" && data.bookingId) {
    navigationRef.navigate("Chat", {
      bookingId: String(data.bookingId),
      spotTitle: typeof data.spotTitle === "string" ? data.spotTitle : undefined,
    });
  } else {
    navigationRef.navigate("Main", { screen: "Bookings" });
  }
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_600SemiBold,
    Poppins_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    // Treat both "fonts loaded" and "font failed to load" as ready so a font
    // failure never prevents the app from rendering.
    if (fontsLoaded || fontError) {
      setAppReady(true);
    }
  }, [fontsLoaded, fontError]);

  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      try {
        await SplashScreen.hideAsync();
      } catch {
        /* ignore — splash may already be hidden */
      }
    }
  }, [appReady]);

  // Route notification taps (including the cold-start one) to their screens.
  useEffect(() => pushService.addResponseListener(handleNotificationTap), []);

  if (!appReady) {
    // Render nothing until fonts resolve; the native splash stays visible.
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <BottomSheetModalProvider>
              <ToastProvider>
                <NavigationContainer
                  ref={navigationRef}
                  onReady={() => {
                    if (pendingTap) {
                      const tap = pendingTap;
                      pendingTap = null;
                      handleNotificationTap(tap);
                    }
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <StatusBar style="auto" />
                    <RootNavigator />
                  </View>
                </NavigationContainer>
              </ToastProvider>
            </BottomSheetModalProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
