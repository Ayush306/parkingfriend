import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Switch } from "react-native";
import { MotiView } from "moti";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "@/theme/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { Card } from "@/components/ui/Card";
import { ListItem } from "@/components/ui/ListItem";
import { Divider } from "@/components/ui/Divider";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { haptics } from "@/utils/haptics";

const SETTINGS_KEY = "pm_settings";

interface SwitchSettings {
  notifBooking: boolean;
  notifOffers: boolean;
  notifHost: boolean;
  notifSound: boolean;
  locationAccess: boolean;
  personalizedAds: boolean;
}

const DEFAULT_SETTINGS: SwitchSettings = {
  notifBooking: true,
  notifOffers: true,
  notifHost: true,
  notifSound: false,
  locationAccess: true,
  personalizedAds: false,
};

export default function Settings() {
  const navigation = useNavigation<any>();
  const { colors, spacing, typography, radius, isDark, toggle } = useTheme();
  const { logout } = useAuth();
  const toast = useToast();

  const [settings, setSettings] = useState<SwitchSettings>(DEFAULT_SETTINGS);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Load persisted switch states on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (active && raw) {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
        }
      } catch {
        // keep defaults
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setSwitch = useCallback(
    (key: keyof SwitchSettings, value: boolean) => {
      haptics.selection();
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  const handleDeleteAccount = useCallback(async () => {
    setConfirmDelete(false);
    toast.show("Account scheduled for deletion", "warning");
    try {
      await logout();
      haptics.success();
      navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
    } catch {
      toast.show("Something went wrong. Please try again.", "error");
    }
  }, [logout, navigation, toast]);

  const trackColor = { false: colors.border, true: colors.primary };

  return (
    <Screen scroll padded>
      <Header title="Settings" showBack onBack={() => navigation.goBack()} />

      {/* Notifications */}
      <Section title="Notifications" icon="notifications-outline" delay={0}>
        <SwitchRow
          icon="calendar-outline"
          title="Booking updates"
          subtitle="Confirmations, reminders & OTPs"
          value={settings.notifBooking}
          onChange={(v) => setSwitch("notifBooking", v)}
          trackColor={trackColor}
        />
        <Divider inset={spacing.xl + spacing.xxl} />
        <SwitchRow
          icon="pricetags-outline"
          title="Offers & promotions"
          subtitle="Coupons and cashback deals"
          value={settings.notifOffers}
          onChange={(v) => setSwitch("notifOffers", v)}
          trackColor={trackColor}
        />
        <Divider inset={spacing.xl + spacing.xxl} />
        <SwitchRow
          icon="home-outline"
          title="Host activity"
          subtitle="New requests for your spaces"
          value={settings.notifHost}
          onChange={(v) => setSwitch("notifHost", v)}
          trackColor={trackColor}
        />
        <Divider inset={spacing.xl + spacing.xxl} />
        <SwitchRow
          icon="volume-high-outline"
          title="Sound & vibration"
          subtitle="Play a tone for new alerts"
          value={settings.notifSound}
          onChange={(v) => setSwitch("notifSound", v)}
          trackColor={trackColor}
        />
      </Section>

      {/* Appearance */}
      <Section title="Appearance" icon="color-palette-outline" delay={80}>
        <SwitchRow
          icon={isDark ? "moon" : "moon-outline"}
          title="Dark mode"
          subtitle={isDark ? "Currently on" : "Easy on the eyes at night"}
          value={isDark}
          onChange={() => {
            haptics.selection();
            toggle();
          }}
          trackColor={trackColor}
        />
      </Section>

      {/* Language & region */}
      <Section title="Language & region" icon="globe-outline" delay={140}>
        <ListItem
          title="App language"
          subtitle="Choose your preferred language"
          onPress={() => toast.show("English is the only language for now", "info")}
          leftIcon={
            <Ionicons name="language-outline" size={20} color={colors.primary} />
          }
          right={
            <View style={styles.valueRow}>
              <Text
                style={{
                  fontFamily: typography.fonts.bodyMedium,
                  fontSize: typography.sizes.sm,
                  color: colors.textSecondary,
                  marginRight: 6,
                }}
              >
                English
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          }
        />
        <Divider inset={spacing.xl + spacing.xxl} />
        <ListItem
          title="Region"
          subtitle="Currency & distance units"
          onPress={() => toast.show("Region locked to India (₹, km)", "info")}
          leftIcon={
            <Ionicons name="map-outline" size={20} color={colors.primary} />
          }
          right={
            <View style={styles.valueRow}>
              <Text
                style={{
                  fontFamily: typography.fonts.bodyMedium,
                  fontSize: typography.sizes.sm,
                  color: colors.textSecondary,
                  marginRight: 6,
                }}
              >
                India · ₹
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          }
        />
      </Section>

      {/* Privacy */}
      <Section title="Privacy" icon="lock-closed-outline" delay={200}>
        <SwitchRow
          icon="location-outline"
          title="Location access"
          subtitle="Show parking spots near you"
          value={settings.locationAccess}
          onChange={(v) => setSwitch("locationAccess", v)}
          trackColor={trackColor}
        />
        <Divider inset={spacing.xl + spacing.xxl} />
        <SwitchRow
          icon="megaphone-outline"
          title="Personalized offers"
          subtitle="Use my activity to tailor deals"
          value={settings.personalizedAds}
          onChange={(v) => setSwitch("personalizedAds", v)}
          trackColor={trackColor}
        />
        <Divider inset={spacing.xl + spacing.xxl} />
        <ListItem
          title="Terms & Privacy Policy"
          onPress={() => navigation.navigate("TermsPrivacy")}
          leftIcon={
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={colors.primary}
            />
          }
        />
        <Divider inset={spacing.xl + spacing.xxl} />
        <ListItem
          title="Download my data"
          subtitle="Export a copy of your information"
          onPress={() => toast.show("We'll email your data within 24 hours", "success")}
          leftIcon={
            <Feather name="download" size={19} color={colors.primary} />
          }
        />
      </Section>

      {/* Danger zone */}
      <View style={{ marginTop: spacing.xl }}>
        <Card padded={false} style={{ paddingVertical: spacing.xs }}>
          <ListItem
            title="Delete account"
            subtitle="Permanently remove your data"
            danger
            onPress={() => setConfirmDelete(true)}
            leftIcon={
              <Feather name="trash-2" size={19} color={colors.error} />
            }
            right={
              <Ionicons name="chevron-forward" size={18} color={colors.error} />
            }
          />
        </Card>
      </View>

      <View style={styles.footer}>
        <Badge label="Parkmitter v1.0.0" tone="neutral" size="sm" />
      </View>

      <ConfirmDialog
        visible={confirmDelete}
        tone="danger"
        title="Delete account?"
        message="This permanently deletes your bookings, wallet balance and listed spaces. This action can't be undone."
        confirmLabel="Delete"
        cancelLabel="Keep account"
        onConfirm={handleDeleteAccount}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

interface SectionProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  delay?: number;
  children: React.ReactNode;
}

function Section({ title, icon, delay = 0, children }: SectionProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 400, delay }}
      style={{ marginTop: spacing.xl }}
    >
      <View style={[styles.sectionHead, { marginBottom: spacing.sm }]}>
        <Ionicons name={icon} size={16} color={colors.textSecondary} />
        <Text
          style={{
            marginLeft: 6,
            fontFamily: typography.fonts.bodySemi,
            fontSize: typography.sizes.sm,
            color: colors.textSecondary,
            letterSpacing: 0.3,
            textTransform: "uppercase",
          }}
        >
          {title}
        </Text>
      </View>
      <Card padded={false} style={{ paddingVertical: spacing.xs }}>
        {children}
      </Card>
    </MotiView>
  );
}

interface SwitchRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  trackColor: { false: string; true: string };
}

function SwitchRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
  trackColor,
}: SwitchRowProps) {
  const { colors } = useTheme();
  return (
    <ListItem
      title={title}
      subtitle={subtitle}
      leftIcon={<Ionicons name={icon} size={20} color={colors.primary} />}
      right={
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={trackColor}
          thumbColor={colors.white}
          ios_backgroundColor={colors.border}
          accessibilityLabel={title}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  footer: {
    alignItems: "center",
    marginTop: 28,
  },
});
