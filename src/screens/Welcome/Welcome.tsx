import React, { useCallback } from "react";
import { View, Text, StyleSheet, StatusBar } from "react-native";
import { MotiView } from "moti";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/theme/ThemeContext";
import { Button } from "@/components/ui/Button";
import { ParkingHero } from "@/components/illustrations";
import { haptics } from "@/utils/haptics";

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: "shield-checkmark-outline", label: "Verified hosts" },
  { icon: "flash-outline", label: "Instant booking" },
  { icon: "wallet-outline", label: "Zero platform fees" },
];

export default function Welcome() {
  const navigation = useNavigation<any>();
  const { colors, spacing, radius, typography, gradients } = useTheme();

  const goToLogin = useCallback(() => {
    navigation.navigate("Login");
  }, [navigation]);

  const exploreAsGuest = useCallback(() => {
    haptics.light();
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  }, [navigation]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Gradient hero (top ~55%) */}
      <LinearGradient
        colors={gradients.primary as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        {/* decorative orbs */}
        <View style={[styles.orb, { top: -60, right: -40 }]} />
        <View style={[styles.orbSmall, { top: 120, left: -30 }]} />

        <SafeAreaView edges={["top"]} style={styles.heroSafe}>
          <MotiView
            from={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 14, stiffness: 150 }}
            style={[
              styles.heroArt,
              { backgroundColor: "rgba(255,255,255,0.16)" },
            ]}
          >
            <ParkingHero size={220} color={colors.white} />
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 550, delay: 200 }}
            style={styles.brandRow}
          >
            <Text
              style={{
                fontFamily: typography.fonts.headingBold,
                fontSize: typography.sizes.display,
                color: colors.white,
                letterSpacing: 0.5,
              }}
            >
              ParkingFriend
            </Text>
          </MotiView>
        </SafeAreaView>
      </LinearGradient>

      {/* Content sheet */}
      <SafeAreaView edges={["bottom"]} style={styles.sheetSafe}>
        <View style={[styles.sheet, { paddingHorizontal: spacing.xl }]}>
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 550, delay: 320 }}
          >
            <Text
              style={{
                textAlign: "center",
                fontFamily: typography.fonts.headingBold,
                fontSize: typography.sizes.xxl,
                color: colors.text,
                lineHeight: typography.sizes.xxl * 1.25,
              }}
            >
              Find & book parking{"\n"}near every station
            </Text>
            <Text
              style={{
                marginTop: spacing.sm,
                textAlign: "center",
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.md,
                color: colors.textSecondary,
                lineHeight: typography.sizes.md * 1.5,
              }}
            >
              Your parking friend in Gurugram. Reserve a trusted spot in seconds.
            </Text>
          </MotiView>

          {/* Feature chips */}
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 550, delay: 420 }}
            style={[styles.features, { marginTop: spacing.xl }]}
          >
            {FEATURES.map((f) => (
              <View key={f.label} style={styles.feature}>
                <View
                  style={[
                    styles.featureIcon,
                    {
                      backgroundColor: colors.primaryLight,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <Ionicons name={f.icon} size={20} color={colors.primary} />
                </View>
                <Text
                  style={{
                    marginTop: spacing.xs + 2,
                    fontFamily: typography.fonts.bodyMedium,
                    fontSize: typography.sizes.xs,
                    color: colors.textSecondary,
                    textAlign: "center",
                  }}
                >
                  {f.label}
                </Text>
              </View>
            ))}
          </MotiView>

          {/* Actions */}
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 550, delay: 520 }}
            style={{ marginTop: spacing.xxxl }}
          >
            <Button
              label="Continue with phone"
              variant="gradient"
              size="lg"
              fullWidth
              onPress={goToLogin}
              iconLeft={
                <Ionicons name="call-outline" size={20} color={colors.white} />
              }
            />
            <View style={{ height: spacing.sm }} />
            <Button
              label="Explore as guest"
              variant="ghost"
              size="lg"
              fullWidth
              onPress={exploreAsGuest}
              iconRight={
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={colors.primary}
                />
              }
            />
          </MotiView>

          <Text
            style={{
              marginTop: spacing.lg,
              textAlign: "center",
              fontFamily: typography.fonts.body,
              fontSize: typography.sizes.xs,
              color: colors.textMuted,
              lineHeight: typography.sizes.xs * 1.5,
            }}
          >
            By continuing you agree to our Terms & Privacy Policy.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    height: "52%",
    overflow: "hidden",
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  heroSafe: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroArt: {
    width: 260,
    height: 260,
    borderRadius: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  brandRow: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  sheetSafe: {
    flex: 1,
  },
  sheet: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 20,
  },
  features: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  feature: {
    alignItems: "center",
    flex: 1,
  },
  featureIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  orb: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  orbSmall: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
});
