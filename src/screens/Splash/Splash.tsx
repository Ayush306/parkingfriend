import React, { useEffect } from "react";
import { View, Text, StyleSheet, StatusBar } from "react-native";
import { MotiView } from "moti";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/theme/ThemeContext";
import { useAuth } from "@/context/AuthContext";

/**
 * Splash — animated ParkingFriend brand reveal.
 *
 * Shows the gradient "P" mark + wordmark + tagline with a moti fade/scale
 * intro, then auto-advances (~1.6s) to the correct entry point based on the
 * persisted auth/onboarding state resolved by AuthContext.
 */
export default function Splash() {
  const navigation = useNavigation<any>();
  const { colors, typography, spacing, radius, gradients } = useTheme();
  const { initializing, isOnboarded, isAuthed } = useAuth();

  useEffect(() => {
    // Wait for the persisted session/onboarding state to resolve, then hold a
    // beat so the brand animation can play before routing away.
    if (initializing) return;

    const timer = setTimeout(() => {
      let target: "Onboarding" | "Welcome" | "Main";
      if (!isOnboarded) {
        target = "Onboarding";
      } else if (isAuthed) {
        target = "Main";
      } else {
        target = "Welcome";
      }
      navigation.reset({ index: 0, routes: [{ name: target }] });
    }, 1600);

    return () => clearTimeout(timer);
  }, [initializing, isOnboarded, isAuthed, navigation]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={gradients.primary as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* soft decorative orbs */}
      <MotiView
        from={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 0.14, scale: 1 }}
        transition={{ type: "timing", duration: 900 }}
        style={[styles.orb, { top: -70, right: -50, backgroundColor: colors.white }]}
      />
      <MotiView
        from={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 0.1, scale: 1 }}
        transition={{ type: "timing", duration: 900, delay: 150 }}
        style={[styles.orbSmall, { bottom: -40, left: -30, backgroundColor: colors.white }]}
      />

      <View style={styles.center}>
        {/* Gradient "P" mark inside a soft glass tile */}
        <MotiView
          from={{ opacity: 0, scale: 0.5, translateY: 12 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: "spring", damping: 14, stiffness: 160 }}
        >
          <View
            style={[
              styles.mark,
              {
                borderRadius: radius.xxl,
                backgroundColor: "rgba(255,255,255,0.16)",
                borderColor: "rgba(255,255,255,0.35)",
              },
            ]}
          >
            <View
              style={[
                styles.markInner,
                { borderRadius: radius.xl, backgroundColor: colors.white },
              ]}
            >
              <Text
                style={{
                  fontFamily: typography.fonts.headingBold,
                  fontSize: 52,
                  lineHeight: 60,
                  color: colors.primary,
                }}
              >
                P
              </Text>
            </View>
            <View style={[styles.pin, { backgroundColor: colors.accent }]}>
              <Ionicons name="location" size={16} color={colors.white} />
            </View>
          </View>
        </MotiView>

        {/* Wordmark */}
        <MotiView
          from={{ opacity: 0, translateY: 14 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 600, delay: 260 }}
        >
          <Text
            style={{
              marginTop: spacing.xxl,
              fontFamily: typography.fonts.headingBold,
              fontSize: typography.sizes.display,
              color: colors.white,
              letterSpacing: 0.5,
            }}
          >
            ParkingFriend
          </Text>
        </MotiView>

        {/* Tagline */}
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 600, delay: 440 }}
        >
          <Text
            style={{
              marginTop: spacing.sm,
              fontFamily: typography.fonts.bodyMedium,
              fontSize: typography.sizes.md,
              color: "rgba(255,255,255,0.9)",
              letterSpacing: 0.3,
            }}
          >
            Your parking friend
          </Text>
        </MotiView>
      </View>

      {/* Loading pulse footer */}
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: "timing", duration: 500, delay: 700 }}
        style={styles.footer}
      >
        <MotiView
          from={{ opacity: 0.3, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            type: "timing",
            duration: 650,
            loop: true,
            repeatReverse: true,
          }}
          style={[styles.dot, { backgroundColor: colors.white }]}
        />
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  mark: {
    width: 116,
    height: 116,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  markInner: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  pin: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    position: "absolute",
    bottom: 56,
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  orb: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  orbSmall: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
  },
});
