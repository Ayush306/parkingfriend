import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useTheme } from "@/theme/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ListItem } from "@/components/ui/ListItem";
import { Divider } from "@/components/ui/Divider";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAsync } from "@/hooks/useAsync";
import { userService } from "@/services/userService";
import { bookingService } from "@/services/bookingService";
import { spotService } from "@/services/spotService";
import { hostService } from "@/services/hostService";
import { formatDate } from "@/utils/format";
import { haptics } from "@/utils/haptics";
import type { User } from "@/models/types";

interface ProfileStats {
  bookings: number;
  saved: number;
  listed: number;
}

interface ProfilePayload {
  user: User;
  stats: ProfileStats;
}

async function loadProfile(): Promise<ProfilePayload> {
  const [user, bookings, favorites, listings] = await Promise.all([
    userService.getProfile(),
    bookingService.list(),
    spotService.getFavorites(),
    hostService.getListings(),
  ]);
  return {
    user,
    stats: {
      bookings: bookings.length,
      saved: favorites.length,
      listed: listings.length,
    },
  };
}

interface MenuEntry {
  key: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  params?: Record<string, unknown>;
}

const MENU: MenuEntry[] = [
  {
    key: "edit",
    title: "Edit profile",
    subtitle: "Name, email & avatar",
    icon: "person-outline",
    route: "EditProfile",
  },
  {
    key: "reports",
    title: "My reports",
    subtitle: "Host earnings & insights",
    icon: "bar-chart-outline",
    route: "Reports",
  },
  {
    key: "wallet",
    title: "Wallet",
    subtitle: "Your savings & earnings",
    icon: "wallet-outline",
    route: "Wallet",
  },
  {
    key: "favorites",
    title: "Favorites",
    subtitle: "Your saved parking spots",
    icon: "heart-outline",
    route: "Favorites",
  },
  {
    key: "notifications",
    title: "Notifications",
    subtitle: "Alerts & offers",
    icon: "notifications-outline",
    route: "Notifications",
  },
  {
    key: "settings",
    title: "Settings",
    subtitle: "Preferences & privacy",
    icon: "settings-outline",
    route: "Settings",
  },
  {
    key: "help",
    title: "Help & Support",
    subtitle: "FAQs and contact us",
    icon: "help-buoy-outline",
    route: "HelpSupport",
  },
  {
    key: "about",
    title: "About",
    subtitle: "About ParkingFriend",
    icon: "information-circle-outline",
    route: "About",
  },
  {
    key: "feedback",
    title: "Feedback",
    subtitle: "Share your thoughts",
    icon: "chatbubble-ellipses-outline",
    route: "Feedback",
  },
  {
    key: "terms",
    title: "Terms & Privacy",
    subtitle: "Policies & agreements",
    icon: "shield-checkmark-outline",
    route: "TermsPrivacy",
  },
];

export default function Profile() {
  const navigation = useNavigation<any>();
  const { colors, spacing, typography, radius, shadows, gradients } = useTheme();
  const { logout } = useAuth();
  const toast = useToast();

  const { data, loading, error, refetch } = useAsync<ProfilePayload>(
    loadProfile,
    []
  );
  const [refreshing, setRefreshing] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refetch();
    // Give the async hook a beat to resolve before dropping the spinner.
    setTimeout(() => setRefreshing(false), 900);
  }, [refetch]);

  const handleLogout = useCallback(async () => {
    setConfirmLogout(false);
    setLoggingOut(true);
    try {
      await logout();
      haptics.success();
      // RootNavigator reacts to auth state; also route defensively.
      navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
    } catch {
      setLoggingOut(false);
      toast.show("Couldn't log out. Please try again.", "error");
    }
  }, [logout, navigation, toast]);

  const user = data?.user;
  const stats = data?.stats;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.huge }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {/* Gradient header */}
        <LinearGradient
          colors={gradients.primary as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={["top"]}>
            <MotiView
              from={{ opacity: 0, translateY: -8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 320 }}
              style={[
                styles.headerBar,
                { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
              ]}
            >
              <Text
                style={{
                  fontFamily: typography.fonts.headingBold,
                  fontSize: typography.sizes.xxl,
                  color: colors.white,
                }}
              >
                Profile
              </Text>
              <Pressable
                onPress={() => {
                  haptics.light();
                  navigation.navigate("Settings");
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Open settings"
                style={({ pressed }) => [
                  styles.headerIconBtn,
                  {
                    backgroundColor: "rgba(255,255,255,0.18)",
                    borderRadius: radius.pill,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name="settings-outline" size={20} color={colors.white} />
              </Pressable>
            </MotiView>

            {/* Identity block */}
            <MotiView
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 420, delay: 80 }}
              style={[styles.identity, { paddingHorizontal: spacing.xl }]}
            >
              <View
                style={[
                  styles.avatarRing,
                  { borderColor: "rgba(255,255,255,0.5)", borderRadius: radius.pill },
                ]}
              >
                <Avatar uri={user?.avatar} name={user?.name} size={84} />
              </View>

              {loading && !user ? (
                <View style={{ flex: 1, marginLeft: spacing.lg }}>
                  <Skeleton width="70%" height={22} />
                  <View style={{ height: spacing.sm }} />
                  <Skeleton width="50%" height={14} />
                  <View style={{ height: spacing.sm }} />
                  <Skeleton width="40%" height={14} />
                </View>
              ) : (
                <View style={{ flex: 1, marginLeft: spacing.lg }}>
                  <View style={styles.nameRow}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: typography.fonts.headingBold,
                        fontSize: typography.sizes.xxl,
                        color: colors.white,
                        flexShrink: 1,
                      }}
                    >
                      {user?.name ?? "Guest"}
                    </Text>
                    {user?.verified ? (
                      <View style={{ marginLeft: spacing.sm }}>
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={colors.white}
                        />
                      </View>
                    ) : null}
                  </View>

                  <Text
                    numberOfLines={1}
                    style={{
                      marginTop: 2,
                      fontFamily: typography.fonts.body,
                      fontSize: typography.sizes.sm,
                      color: "rgba(255,255,255,0.9)",
                    }}
                  >
                    {user?.phone ?? ""}
                  </Text>

                  <View style={styles.metaRow}>
                    <View
                      style={[
                        styles.ratingPill,
                        {
                          backgroundColor: "rgba(255,255,255,0.18)",
                          borderRadius: radius.pill,
                          paddingHorizontal: spacing.sm + 2,
                          paddingVertical: 3,
                        },
                      ]}
                    >
                      <Ionicons name="star" size={13} color={colors.accent} />
                      <Text
                        style={{
                          marginLeft: 4,
                          fontFamily: typography.fonts.bodySemi,
                          fontSize: typography.sizes.xs,
                          color: colors.white,
                        }}
                      >
                        {(user?.rating ?? 0).toFixed(1)}
                      </Text>
                    </View>
                    {user?.verified ? (
                      <View style={{ marginLeft: spacing.sm }}>
                        <Badge label="Verified" tone="success" size="sm" />
                      </View>
                    ) : null}
                  </View>
                </View>
              )}
            </MotiView>

            {user?.memberSince ? (
              <Text
                style={{
                  paddingHorizontal: spacing.xl,
                  marginTop: spacing.md,
                  fontFamily: typography.fonts.bodyMedium,
                  fontSize: typography.sizes.xs,
                  color: "rgba(255,255,255,0.8)",
                }}
              >
                Member since {formatDate(user.memberSince, { withYear: true })}
              </Text>
            ) : null}
          </SafeAreaView>
        </LinearGradient>

        {/* Stat row (overlaps header) */}
        <View style={[styles.statWrap, { paddingHorizontal: spacing.xl }]}>
          <Card
            elevated
            padded={false}
            style={{ borderRadius: radius.lg, paddingVertical: spacing.md }}
          >
            <View style={styles.statRow}>
              <StatCell
                icon="calendar-outline"
                label="Bookings"
                value={stats?.bookings}
                loading={loading && !stats}
                onPress={() => navigation.navigate("Bookings")}
              />
              <Divider vertical inset={spacing.sm} />
              <StatCell
                icon="heart-outline"
                label="Saved"
                value={stats?.saved}
                loading={loading && !stats}
                onPress={() => navigation.navigate("Favorites")}
              />
              <Divider vertical inset={spacing.sm} />
              <StatCell
                icon="business-outline"
                label="Listed"
                value={stats?.listed}
                loading={loading && !stats}
                onPress={() => navigation.navigate("HostRequests")}
              />
            </View>
          </Card>
        </View>

        {/* Become a host CTA */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
          <Pressable
            onPress={() => {
              haptics.light();
              navigation.navigate("ListSpace");
            }}
            accessibilityRole="button"
            accessibilityLabel="Become a host, list your space"
            style={({ pressed }) => ({
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <LinearGradient
              colors={gradients.violet as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.hostCta,
                { borderRadius: radius.lg, padding: spacing.lg, ...shadows.md },
              ]}
            >
              <View
                style={[
                  styles.hostIcon,
                  { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: radius.md },
                ]}
              >
                <Ionicons name="home" size={22} color={colors.white} />
              </View>
              <View style={{ flex: 1, marginHorizontal: spacing.md }}>
                <Text
                  style={{
                    fontFamily: typography.fonts.heading,
                    fontSize: typography.sizes.md,
                    color: colors.white,
                  }}
                >
                  Become a host
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    fontFamily: typography.fonts.body,
                    fontSize: typography.sizes.sm,
                    color: "rgba(255,255,255,0.9)",
                  }}
                >
                  List your empty space & earn ₹ every day
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.white} />
            </LinearGradient>
          </Pressable>
        </View>

        {/* Menu */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
          <Card padded={false} style={{ paddingVertical: spacing.xs }}>
            {MENU.map((entry, i) => (
              <View key={entry.key}>
                <ListItem
                  title={entry.title}
                  subtitle={entry.subtitle}
                  onPress={() =>
                    navigation.navigate(entry.route as never, entry.params as never)
                  }
                  leftIcon={
                    <Ionicons name={entry.icon} size={20} color={colors.primary} />
                  }
                />
                {i < MENU.length - 1 ? (
                  <Divider inset={spacing.xl + spacing.xxl} />
                ) : null}
              </View>
            ))}
          </Card>
        </View>

        {/* Logout */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
          <Card padded={false} style={{ paddingVertical: spacing.xs }}>
            <ListItem
              title={loggingOut ? "Logging out…" : "Log out"}
              danger
              onPress={loggingOut ? undefined : () => setConfirmLogout(true)}
              leftIcon={
                <Feather name="log-out" size={19} color={colors.error} />
              }
              right={
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.error}
                />
              }
            />
          </Card>
        </View>

        {error && !data ? (
          <Text
            onPress={refetch}
            style={{
              textAlign: "center",
              marginTop: spacing.lg,
              color: colors.primary,
              fontFamily: typography.fonts.bodySemi,
              fontSize: typography.sizes.sm,
            }}
          >
            Couldn't refresh profile · Tap to retry
          </Text>
        ) : null}

        <Text
          style={{
            textAlign: "center",
            marginTop: spacing.xl,
            color: colors.textMuted,
            fontFamily: typography.fonts.body,
            fontSize: typography.sizes.xs,
          }}
        >
          ParkingFriend v1.0.0
        </Text>
      </ScrollView>

      <ConfirmDialog
        visible={confirmLogout}
        tone="danger"
        title="Log out?"
        message="You'll need to sign in again to book or manage your parking spots."
        confirmLabel="Log out"
        cancelLabel="Stay"
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </View>
  );
}

interface StatCellProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: number;
  loading?: boolean;
  onPress?: () => void;
}

function StatCell({ icon, label, value, loading, onPress }: StatCellProps) {
  const { colors, typography, spacing } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${value ?? 0} ${label}`}
      style={({ pressed }) => [
        styles.statCell,
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={colors.primary} />
      {loading ? (
        <View style={{ marginTop: spacing.xs + 2, alignItems: "center" }}>
          <Skeleton width={28} height={18} radius={6} />
        </View>
      ) : (
        <Text
          style={{
            marginTop: spacing.xs,
            fontFamily: typography.fonts.headingBold,
            fontSize: typography.sizes.xl,
            color: colors.text,
          }}
        >
          {value ?? 0}
        </Text>
      )}
      <Text
        style={{
          marginTop: 2,
          fontFamily: typography.fonts.body,
          fontSize: typography.sizes.xs,
          color: colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerGradient: {
    paddingBottom: 44,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
  },
  avatarRing: {
    padding: 3,
    borderWidth: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
  },
  statWrap: {
    marginTop: -28,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  hostCta: {
    flexDirection: "row",
    alignItems: "center",
  },
  hostIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
