import React from "react";
import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { MotiView } from "moti";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { useTheme } from "@/theme/ThemeContext";
import { haptics } from "@/utils/haptics";
import {
  APP_NAME,
  APP_TAGLINE,
  APP_VERSION,
  APP_DESCRIPTION,
  COMPANY,
  SOCIAL_LINKS,
} from "@/constants";

interface Step {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: "search",
    title: "Find a spot",
    body: "Search verified driveways, garages and lots near your station or destination.",
  },
  {
    icon: "calendar",
    title: "Book & pay",
    body: "Pick your date and time, add vehicle details and pay securely in seconds.",
  },
  {
    icon: "car-sport",
    title: "Park with ease",
    body: "Share your OTP with the host, park worry-free and unlock contact if you need help.",
  },
];

interface LinkRowDef {
  icon: React.ReactNode;
  label: string;
  value: string;
  onPress: () => void;
}

export default function About() {
  const navigation = useNavigation<any>();
  const { colors, spacing, typography, radius, gradients, shadows } = useTheme();

  const open = (url: string) => {
    haptics.light();
    Linking.openURL(url).catch(() => {});
  };

  const links: LinkRowDef[] = [
    {
      icon: <Feather name="globe" size={18} color={colors.primary} />,
      label: "Website",
      value: COMPANY.website,
      onPress: () => open(`https://${COMPANY.website}`),
    },
    {
      icon: <Feather name="instagram" size={18} color={colors.secondary} />,
      label: "Instagram",
      value: "@parkmitter",
      onPress: () => open(SOCIAL_LINKS.instagram),
    },
    {
      icon: <Feather name="twitter" size={18} color={colors.info} />,
      label: "Twitter / X",
      value: "@parkmitter",
      onPress: () => open(SOCIAL_LINKS.twitter),
    },
    {
      icon: <Feather name="linkedin" size={18} color={colors.primaryDark} />,
      label: "LinkedIn",
      value: "Parkmitter",
      onPress: () => open(SOCIAL_LINKS.linkedin),
    },
  ];

  return (
    <Screen scroll padded>
      <Header showBack title="About" onBack={() => navigation.goBack()} />

      {/* App mark */}
      <MotiView
        from={{ opacity: 0, translateY: 14, scale: 0.96 }}
        animate={{ opacity: 1, translateY: 0, scale: 1 }}
        transition={{ type: "timing", duration: 420 }}
        style={{ alignItems: "center", marginVertical: spacing.lg }}
      >
        <LinearGradient
          colors={gradients.primary as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.mark,
            { borderRadius: radius.xxl, ...shadows.lg },
          ]}
        >
          <Ionicons name="car-sport" size={40} color={colors.white} />
        </LinearGradient>
        <Text
          style={{
            color: colors.text,
            fontFamily: typography.fonts.headingBold,
            fontSize: typography.sizes.xxl,
            marginTop: spacing.md,
          }}
        >
          {APP_NAME}
        </Text>
        <Text
          style={{
            color: colors.primary,
            fontFamily: typography.fonts.bodyMedium,
            fontSize: typography.sizes.md,
            marginTop: 2,
          }}
        >
          {APP_TAGLINE}
        </Text>
        <View
          style={[
            styles.versionPill,
            {
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.pill,
              marginTop: spacing.md,
            },
          ]}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.bodyMedium,
              fontSize: typography.sizes.xs,
            }}
          >
            Version {APP_VERSION}
          </Text>
        </View>
      </MotiView>

      {/* Mission */}
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 380, delay: 90 }}
      >
        <Card elevated>
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fonts.heading,
              fontSize: typography.sizes.lg,
              marginBottom: spacing.sm,
            }}
          >
            Our mission
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.body,
              fontSize: typography.sizes.md,
              lineHeight: 24,
            }}
          >
            {APP_DESCRIPTION} We believe every empty driveway is an opportunity —
            to save a commuter time and stress, and to help a host earn from
            space that would otherwise sit idle. Parkmitter is your parking
            friend: warm, trusted and always nearby.
          </Text>
        </Card>
      </MotiView>

      {/* How it works */}
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 380, delay: 150 }}
        style={{ marginTop: spacing.xl }}
      >
        <Text
          style={{
            color: colors.text,
            fontFamily: typography.fonts.heading,
            fontSize: typography.sizes.lg,
            marginBottom: spacing.md,
          }}
        >
          How Parkmitter works
        </Text>
        <Card elevated>
          {STEPS.map((step, i) => (
            <View key={step.title}>
              <View style={styles.stepRow}>
                <View
                  style={[
                    styles.stepNumWrap,
                    {
                      backgroundColor: colors.primaryLight,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <Ionicons
                    name={step.icon}
                    size={20}
                    color={colors.primary}
                  />
                  <View
                    style={[
                      styles.stepBadge,
                      {
                        backgroundColor: colors.primary,
                        borderColor: colors.surface,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: colors.white,
                        fontFamily: typography.fonts.bodySemi,
                        fontSize: 10,
                      }}
                    >
                      {i + 1}
                    </Text>
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontFamily: typography.fonts.bodySemi,
                      fontSize: typography.sizes.md,
                    }}
                  >
                    {step.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: typography.fonts.body,
                      fontSize: typography.sizes.sm,
                      lineHeight: 20,
                      marginTop: 2,
                    }}
                  >
                    {step.body}
                  </Text>
                </View>
              </View>
              {i < STEPS.length - 1 ? (
                <Divider style={{ marginVertical: spacing.md }} inset={4} />
              ) : null}
            </View>
          ))}
        </Card>
      </MotiView>

      {/* Links */}
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 380, delay: 210 }}
        style={{ marginTop: spacing.xl }}
      >
        <Text
          style={{
            color: colors.text,
            fontFamily: typography.fonts.heading,
            fontSize: typography.sizes.lg,
            marginBottom: spacing.md,
          }}
        >
          Connect with us
        </Text>
        <Card elevated padded={false}>
          {links.map((row, i) => (
            <View key={row.label}>
              <Pressable
                onPress={row.onPress}
                accessibilityRole="link"
                accessibilityLabel={`${row.label}, ${row.value}`}
                style={({ pressed }) => [
                  styles.linkRow,
                  {
                    padding: spacing.lg,
                    backgroundColor: pressed
                      ? colors.surfaceAlt
                      : "transparent",
                  },
                ]}
              >
                <View
                  style={[
                    styles.linkIcon,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  {row.icon}
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontFamily: typography.fonts.bodySemi,
                      fontSize: typography.sizes.md,
                    }}
                  >
                    {row.label}
                  </Text>
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontFamily: typography.fonts.body,
                      fontSize: typography.sizes.sm,
                      marginTop: 1,
                    }}
                  >
                    {row.value}
                  </Text>
                </View>
                <Feather
                  name="external-link"
                  size={16}
                  color={colors.textMuted}
                />
              </Pressable>
              {i < links.length - 1 ? <Divider inset={spacing.lg} /> : null}
            </View>
          ))}
        </Card>
      </MotiView>

      {/* Legal + made in India */}
      <View style={{ alignItems: "center", marginTop: spacing.xxl }}>
        <Text
          style={{
            color: colors.textMuted,
            fontFamily: typography.fonts.body,
            fontSize: typography.sizes.xs,
            textAlign: "center",
          }}
        >
          {COMPANY.name}
        </Text>
        <Text
          style={{
            color: colors.textMuted,
            fontFamily: typography.fonts.body,
            fontSize: typography.sizes.xs,
            textAlign: "center",
            marginTop: 2,
          }}
        >
          {COMPANY.address}
        </Text>
        <View style={[styles.madeIn, { marginTop: spacing.md }]}>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.bodyMedium,
              fontSize: typography.sizes.sm,
            }}
          >
            Made with{"  "}
          </Text>
          <Ionicons name="heart" size={14} color={colors.error} />
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.bodyMedium,
              fontSize: typography.sizes.sm,
            }}
          >
            {"  "}in India
          </Text>
        </View>
        <Text
          style={{
            color: colors.textMuted,
            fontFamily: typography.fonts.body,
            fontSize: typography.sizes.xs,
            marginTop: spacing.sm,
          }}
        >
          © {new Date().getFullYear()} {APP_NAME}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
  },
  versionPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stepNumWrap: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  linkIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  madeIn: {
    flexDirection: "row",
    alignItems: "center",
  },
});
