import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  FlatList,
  Image,
  Dimensions,
  TextInput,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";

import { useTheme } from "@/theme/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { useFavorites } from "@/hooks/useFavorites";
import { haptics } from "@/utils/haptics";
import { spotService } from "@/services/spotService";
import { bookingService } from "@/services/bookingService";
import { hostService } from "@/services/hostService";
import { walletService } from "@/services/walletService";
import { formatCurrency, formatDate } from "@/utils/format";

import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SpotCard } from "@/components/ui/SpotCard";
import { SkeletonCard, Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import type {
  Booking,
  Coupon,
  HostRequest,
  ParkingSpot,
  WalletSummary,
} from "@/models/types";

const { width: SCREEN_W } = Dimensions.get("window");
const PROMO_W = SCREEN_W - 40; // matches Screen horizontal padding (spacing.xl * 2)
const FEATURED_W = 260;

type SearchItem = {
  id: string;
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
};

// Demo dummy data for the search autocomplete (cities, stations, areas).
const SEARCH_ITEMS: SearchItem[] = [
  { id: "c1", label: "Gurugram", sub: "City · Haryana", icon: "business-outline" },
  { id: "c2", label: "New Delhi", sub: "City · Delhi", icon: "business-outline" },
  { id: "c3", label: "Noida", sub: "City · Uttar Pradesh", icon: "business-outline" },
  { id: "c4", label: "Faridabad", sub: "City · Haryana", icon: "business-outline" },
  { id: "c5", label: "Manesar", sub: "City · Haryana", icon: "business-outline" },
  { id: "c6", label: "Ghaziabad", sub: "City · Uttar Pradesh", icon: "business-outline" },
  { id: "s1", label: "Huda City Centre", sub: "Metro station · Gurugram", icon: "train-outline" },
  { id: "s2", label: "IFFCO Chowk", sub: "Metro station · Gurugram", icon: "train-outline" },
  { id: "s3", label: "MG Road", sub: "Metro station · Gurugram", icon: "train-outline" },
  { id: "s4", label: "Sikanderpur", sub: "Metro station · Gurugram", icon: "train-outline" },
  { id: "s5", label: "Rajiv Chowk", sub: "Metro station · New Delhi", icon: "train-outline" },
  { id: "a1", label: "Cyber Hub", sub: "Landmark · DLF Cyber City", icon: "location-outline" },
  { id: "a2", label: "Sector 44", sub: "Area · Gurugram", icon: "location-outline" },
  { id: "a3", label: "Golf Course Road", sub: "Area · Gurugram", icon: "location-outline" },
  { id: "a4", label: "Sohna Road", sub: "Area · Gurugram", icon: "location-outline" },
  { id: "a5", label: "DLF Phase 3", sub: "Area · Gurugram", icon: "location-outline" },
  { id: "a6", label: "Connaught Place", sub: "Area · New Delhi", icon: "location-outline" },
];

// Demo recent searches shown in the "Recent activity" section.
const RECENT_SEARCHES = [
  "Huda City Centre",
  "Cyber Hub",
  "Sector 44",
  "MG Road",
  "Sohna Road",
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const navigation = useNavigation<any>();
  const { colors, spacing, typography, radius, shadows, gradients } = useTheme();
  const { user } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const recentBookings = useAsync<Booking[]>(() => bookingService.list(), []);
  const popular = useAsync<ParkingSpot[]>(() => spotService.getPopular(), []);
  const hostEarnings = useAsync<WalletSummary>(() => walletService.getSummary(), []);
  const hostListings = useAsync<ParkingSpot[]>(() => hostService.getListings(), []);
  const hostRequests = useAsync<HostRequest[]>(() => hostService.getRequests(), []);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const firstName = useMemo(() => {
    const name = user?.name ?? "Aarav Malhotra";
    return name.split(" ")[0];
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    recentBookings.refetch();
    popular.refetch();
    hostEarnings.refetch();
    hostListings.refetch();
    hostRequests.refetch();
    // brief guard so the spinner shows while services resolve
    setTimeout(() => setRefreshing(false), 900);
  }, [recentBookings, popular, hostEarnings, hostListings, hostRequests]);

  const openSpot = useCallback(
    (id: string) => navigation.navigate("SpotDetail", { id }),
    [navigation]
  );

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SEARCH_ITEMS.slice(0, 6);
    return SEARCH_ITEMS.filter(
      (it) =>
        it.label.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q)
    );
  }, [query]);

  const closeSearch = useCallback(() => {
    setSearchFocused(false);
    Keyboard.dismiss();
  }, []);

  const submitQuery = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      closeSearch();
      navigation.navigate("SearchResults", { query: t });
    },
    [closeSearch, navigation]
  );

  const useMyLocation = useCallback(() => {
    closeSearch();
    setQuery("");
    navigation.navigate("Explore");
  }, [closeSearch, navigation]);

  const popularList = (popular.data ?? []).slice(0, 6);

  const pendingRequests = (hostRequests.data ?? []).filter(
    (r) => r.status === "pending"
  );

  const respondToRequest = async (id: string, accept: boolean) => {
    setRespondingId(id);
    try {
      await hostService.respond(id, accept);
      haptics.success();
      toast.show(
        accept ? "Request accepted — contact shared." : "Request declined.",
        accept ? "success" : "info"
      );
      hostRequests.refetch();
    } catch (e: any) {
      haptics.error();
      toast.show(e?.message ?? "Couldn't update the request.", "error");
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.flex, { backgroundColor: colors.bg }]}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: spacing.huge }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
        {/* ── Top bar: greeting + avatar + bell ── */}
        <MotiView
          from={{ opacity: 0, translateY: -8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 340 }}
          style={[styles.topBar, { paddingHorizontal: spacing.xl }]}
        >
          <View style={styles.flex}>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.sm,
              }}
            >
              {greeting()},
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: colors.text,
                fontFamily: typography.fonts.headingBold,
                fontSize: typography.sizes.xxl,
                marginTop: 1,
              }}
            >
              {firstName} 👋
            </Text>
          </View>

          <View style={styles.topActions}>
            <Pressable
              onPress={() => {
                haptics.light();
                navigation.navigate("Notifications");
              }}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              style={({ pressed }) => [
                styles.bell,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.pill,
                  opacity: pressed ? 0.75 : 1,
                  ...shadows.sm,
                },
              ]}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.text} />
              <View style={[styles.bellDot, { backgroundColor: colors.error, borderColor: colors.surface }]} />
            </Pressable>

            <Pressable
              onPress={() => {
                haptics.light();
                navigation.navigate("Profile");
              }}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              style={{ marginLeft: spacing.sm }}
            >
              <Avatar uri={user?.avatar} name={user?.name ?? firstName} size={44} />
            </Pressable>
          </View>
        </MotiView>

        {/* ── Search box (with location + autocomplete dropdown) ── */}
        <View style={{ marginHorizontal: spacing.xl, marginTop: spacing.md }}>
          <View style={styles.searchRow}>
            <View
              style={[
                styles.searchBar,
                styles.flex,
                {
                  backgroundColor: colors.surface,
                  borderColor: searchFocused ? colors.primary : colors.border,
                  borderRadius: radius.md,
                  ...shadows.sm,
                },
              ]}
            >
              <Ionicons name="search" size={20} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                onFocus={() => setSearchFocused(true)}
                placeholder="Search city, station, area or landmark"
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                onSubmitEditing={() => submitQuery(query)}
                accessibilityLabel="Search parking"
                style={{
                  flex: 1,
                  marginLeft: spacing.sm,
                  paddingVertical: 0,
                  color: colors.text,
                  fontFamily: typography.fonts.body,
                  fontSize: typography.sizes.md,
                }}
              />
              {query.length > 0 ? (
                <Pressable
                  onPress={() => setQuery("")}
                  hitSlop={8}
                  accessibilityLabel="Clear search"
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              ) : !searchFocused ? (
                <Pressable
                  onPress={() => {
                    haptics.light();
                    navigation.navigate("Explore");
                  }}
                  accessibilityLabel="Filters"
                  style={[styles.searchTune, { backgroundColor: colors.primary, borderRadius: radius.sm }]}
                >
                  <Feather name="sliders" size={16} color={colors.white} />
                </Pressable>
              ) : null}
            </View>

            {searchFocused ? (
              <Pressable
                onPress={closeSearch}
                hitSlop={8}
                accessibilityLabel="Cancel search"
                style={{ paddingLeft: spacing.md, paddingVertical: 8 }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: typography.fonts.bodySemi,
                    fontSize: typography.sizes.sm,
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Autocomplete dropdown */}
          {searchFocused ? (
            <MotiView
              from={{ opacity: 0, translateY: -6 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 180 }}
              style={[
                styles.suggestPanel,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  ...shadows.md,
                },
              ]}
            >
              {/* First option: your current location */}
              <Pressable
                onPress={useMyLocation}
                accessibilityRole="button"
                accessibilityLabel="Use your current location"
                style={({ pressed }) => [styles.suggestRow, { opacity: pressed ? 0.6 : 1 }]}
              >
                <View style={[styles.suggestIcon, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="navigate" size={16} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text
                    style={{
                      color: colors.primary,
                      fontFamily: typography.fonts.bodySemi,
                      fontSize: typography.sizes.sm,
                    }}
                  >
                    Use your current location
                  </Text>
                  <Text
                    style={{
                      marginTop: 1,
                      color: colors.textMuted,
                      fontFamily: typography.fonts.body,
                      fontSize: typography.sizes.xs,
                    }}
                  >
                    Find parking spots around you
                  </Text>
                </View>
              </Pressable>

              <View style={[styles.suggestDivider, { backgroundColor: colors.border }]} />

              <Text
                style={[
                  styles.suggestLabel,
                  { color: colors.textMuted, fontFamily: typography.fonts.bodySemi },
                ]}
              >
                {query.trim() ? "Results" : "Popular searches"}
              </Text>

              {searchResults.length === 0 ? (
                <View style={styles.suggestEmpty}>
                  <Ionicons name="search" size={18} color={colors.textMuted} />
                  <Text
                    style={{
                      marginTop: 6,
                      color: colors.textMuted,
                      fontFamily: typography.fonts.body,
                      fontSize: typography.sizes.sm,
                    }}
                  >
                    No matches for “{query.trim()}”
                  </Text>
                </View>
              ) : (
                searchResults.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => submitQuery(item.label)}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    style={({ pressed }) => [styles.suggestRow, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <View style={[styles.suggestIcon, { backgroundColor: colors.surfaceAlt }]}>
                      <Ionicons name={item.icon} size={15} color={colors.textSecondary} />
                    </View>
                    <View style={styles.flex}>
                      <Text
                        style={{
                          color: colors.text,
                          fontFamily: typography.fonts.bodyMedium,
                          fontSize: typography.sizes.sm,
                        }}
                      >
                        {item.label}
                      </Text>
                      <Text
                        style={{
                          marginTop: 1,
                          color: colors.textMuted,
                          fontFamily: typography.fonts.body,
                          fontSize: typography.sizes.xs,
                        }}
                      >
                        {item.sub}
                      </Text>
                    </View>
                    <Feather name="arrow-up-left" size={16} color={colors.textMuted} />
                  </Pressable>
                ))
              )}
            </MotiView>
          ) : null}
        </View>

        {/* ── Quick actions ── */}
        <View style={[styles.quickRow, { paddingHorizontal: spacing.xl, marginTop: spacing.xl }]}>
          <QuickAction
            icon="add-circle-outline"
            label="List your space"
            tint={colors.primary}
            tintBg={colors.primaryLight}
            onPress={() => navigation.navigate("ListSpace")}
          />
          <QuickAction
            icon="calendar-outline"
            label="My bookings"
            tint={colors.secondary}
            tintBg="rgba(108,92,231,0.12)"
            onPress={() => navigation.navigate("Bookings")}
          />
          <QuickAction
            icon="wallet-outline"
            label="Wallet"
            tint={colors.accent}
            tintBg="rgba(255,176,32,0.14)"
            onPress={() => navigation.navigate("Wallet")}
          />
        </View>

        {/* ── Recent activity (recent searches + recent bookings) ── */}
        <View style={{ marginTop: spacing.xxl, paddingHorizontal: spacing.xl }}>
          <SectionHeader title="Recent activity" />
        </View>

        {/* Recent searches */}
        <Text
          style={[
            styles.subLabel,
            { marginTop: spacing.xs, paddingHorizontal: spacing.xl, color: colors.textSecondary, fontFamily: typography.fonts.bodySemi },
          ]}
        >
          Recent searches
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingTop: spacing.sm }}
        >
          {RECENT_SEARCHES.map((q) => (
            <Pressable
              key={q}
              onPress={() => {
                haptics.light();
                navigation.navigate("SearchResults", { query: q });
              }}
              accessibilityRole="button"
              accessibilityLabel={`Search ${q}`}
              style={({ pressed }) => [
                styles.searchPill,
                { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
              <Text style={{ marginLeft: 6, color: colors.text, fontFamily: typography.fonts.bodyMedium, fontSize: typography.sizes.sm }}>
                {q}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Recent bookings */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
          <Text style={[styles.subLabel, { color: colors.textSecondary, fontFamily: typography.fonts.bodySemi }]}>
            Recent bookings
          </Text>

          {recentBookings.loading ? (
            <View style={{ marginTop: spacing.sm }}>
              <SkeletonCard />
            </View>
          ) : (recentBookings.data ?? []).length === 0 ? (
            <View
              style={[
                styles.emptyRow,
                { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, marginTop: spacing.sm },
              ]}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
              <Text style={{ marginLeft: spacing.sm, flex: 1, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}>
                No bookings yet. Book a spot and it'll show up here.
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.bookingsCard,
                { backgroundColor: colors.surface, borderRadius: radius.lg, ...shadows.sm },
              ]}
            >
              {(recentBookings.data ?? []).slice(0, 3).map((b, i) => {
                const statusColor =
                  b.status === "cancelled"
                    ? colors.error
                    : b.status === "completed"
                    ? colors.textMuted
                    : b.status === "active"
                    ? colors.success
                    : colors.primary;
                const statusLabel = b.status.charAt(0).toUpperCase() + b.status.slice(1);
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => {
                      haptics.light();
                      navigation.navigate("BookingDetail", { id: b.id });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Booking at ${b.spot.title}`}
                    style={({ pressed }) => [
                      styles.bookingRow,
                      {
                        opacity: pressed ? 0.7 : 1,
                        borderTopColor: colors.border,
                        borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: b.spot.images[0] }}
                      style={[styles.bookingThumb, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}
                    />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text numberOfLines={1} style={{ color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
                        {b.spot.title}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
                        <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                        <Text style={{ marginLeft: 4, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}>
                          {formatDate(b.date)}
                        </Text>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={{ color: statusColor, fontFamily: typography.fonts.bodyMedium, fontSize: typography.sizes.xs }}>
                          {statusLabel}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Your hosting (dual role — you host & book at the same time) ── */}
        <View style={{ marginTop: spacing.xxl, paddingHorizontal: spacing.xl }}>
          <View style={styles.hostHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <View style={[styles.hostHeaderIcon, { backgroundColor: colors.primaryLight, borderRadius: radius.md }]}>
                <Ionicons name="home" size={16} color={colors.primary} />
              </View>
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={{ color: colors.text, fontFamily: typography.fonts.heading, fontSize: typography.sizes.lg }}>
                  Your hosting
                </Text>
                <Text style={{ color: colors.textMuted, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}>
                  You're a host too
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => {
                haptics.light();
                navigation.navigate("HostRequests");
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Manage hosting"
            >
              <Text style={{ color: colors.primary, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
                Manage
              </Text>
            </Pressable>
          </View>

          {/* Host earnings strip */}
          <Pressable
            onPress={() => {
              haptics.light();
              navigation.navigate("Wallet");
            }}
            accessibilityRole="button"
            accessibilityLabel="Host earnings"
            style={({ pressed }) => [{ marginTop: spacing.md, opacity: pressed ? 0.92 : 1, borderRadius: radius.lg, ...shadows.sm }]}
          >
            <LinearGradient
              colors={gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.hostEarnCard, { borderRadius: radius.lg }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: "rgba(255,255,255,0.85)", fontFamily: typography.fonts.bodyMedium, fontSize: typography.sizes.xs }}>
                  Earned as a host
                </Text>
                <Text style={{ marginTop: 2, color: "#FFFFFF", fontFamily: typography.fonts.headingBold, fontSize: typography.sizes.xxl }}>
                  {formatCurrency(hostEarnings.data?.earningsLifetime ?? 0)}
                </Text>
                <Text style={{ marginTop: 1, color: "rgba(255,255,255,0.85)", fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}>
                  +{formatCurrency(hostEarnings.data?.earningsLast3Months ?? 0)} in the last 3 months
                </Text>
              </View>
              <View style={styles.hostEarnBadge}>
                <Ionicons name="trending-up" size={20} color="#FFFFFF" />
              </View>
            </LinearGradient>
          </Pressable>

          {/* Incoming requests */}
          <View style={styles.hostSubHeaderRow}>
            <Text style={[styles.subLabel, { marginBottom: 0, color: colors.textSecondary, fontFamily: typography.fonts.bodySemi }]}>
              Incoming requests
            </Text>
            {pendingRequests.length > 0 ? (
              <View style={[styles.countPill, { backgroundColor: colors.primaryLight }]}>
                <Text style={{ color: colors.primary, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.xs }}>
                  {pendingRequests.length} new
                </Text>
              </View>
            ) : null}
          </View>

          {pendingRequests.length === 0 ? (
            <View style={[styles.emptyRow, { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, marginTop: spacing.sm }]}>
              <Ionicons name="checkmark-done-outline" size={18} color={colors.textMuted} />
              <Text style={{ marginLeft: spacing.sm, flex: 1, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}>
                No pending requests right now.
              </Text>
            </View>
          ) : (
            pendingRequests.slice(0, 2).map((r) => (
              <View
                key={r.id}
                style={[styles.requestCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.sm, ...shadows.sm }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Avatar uri={r.requesterAvatar} name={r.requesterName} size={40} />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
                      {r.requesterName}
                    </Text>
                    <Text numberOfLines={1} style={{ color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}>
                      {r.spotTitle}
                    </Text>
                  </View>
                  <View style={[styles.vehiclePill, { backgroundColor: colors.surfaceAlt }]}>
                    <Ionicons name={r.vehicleType === "bike" ? "bicycle-outline" : "car-outline"} size={12} color={colors.textSecondary} />
                    <Text style={{ marginLeft: 3, color: colors.textSecondary, fontFamily: typography.fonts.bodyMedium, fontSize: 11, textTransform: "capitalize" }}>
                      {r.vehicleType}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.sm }}>
                  <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
                  <Text style={{ marginLeft: 4, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}>
                    {formatDate(r.date)} · {r.time}
                  </Text>
                </View>

                <View style={styles.requestActions}>
                  <Pressable
                    onPress={() => respondToRequest(r.id, false)}
                    disabled={respondingId === r.id}
                    accessibilityRole="button"
                    accessibilityLabel="Decline request"
                    style={({ pressed }) => [styles.declineBtn, { borderColor: colors.border, borderRadius: radius.md, opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
                      Decline
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => respondToRequest(r.id, true)}
                    disabled={respondingId === r.id}
                    accessibilityRole="button"
                    accessibilityLabel="Accept request"
                    style={({ pressed }) => [styles.acceptBtn, { backgroundColor: colors.primary, borderRadius: radius.md, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Text style={{ color: colors.white, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
                      {respondingId === r.id ? "…" : "Accept"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}

          {pendingRequests.length > 2 ? (
            <Pressable
              onPress={() => navigation.navigate("HostRequests")}
              hitSlop={8}
              style={{ marginTop: spacing.sm, alignSelf: "center" }}
              accessibilityRole="button"
              accessibilityLabel="View all requests"
            >
              <Text style={{ color: colors.primary, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
                View all {pendingRequests.length} requests
              </Text>
            </Pressable>
          ) : null}

          {/* Your spaces label */}
          <Text style={[styles.subLabel, { marginTop: spacing.lg, color: colors.textSecondary, fontFamily: typography.fonts.bodySemi }]}>
            Your spaces{hostListings.data ? ` · ${hostListings.data.length}` : ""}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md, paddingTop: spacing.sm }}
        >
          <Pressable
            onPress={() => {
              haptics.light();
              navigation.navigate("ListSpace");
            }}
            accessibilityRole="button"
            accessibilityLabel="List a new space"
            style={({ pressed }) => [styles.addSpaceTile, { borderColor: colors.primary, backgroundColor: colors.primaryLight, borderRadius: radius.lg, opacity: pressed ? 0.8 : 1 }]}
          >
            <View style={[styles.addSpaceIcon, { backgroundColor: colors.surface, borderRadius: radius.pill }]}>
              <Ionicons name="add" size={22} color={colors.primary} />
            </View>
            <Text style={{ marginTop: spacing.sm, color: colors.primaryDark, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm, textAlign: "center" }}>
              List a new space
            </Text>
          </Pressable>

          {(hostListings.data ?? []).map((sp) => (
            <Pressable
              key={sp.id}
              onPress={() => openSpot(sp.id)}
              accessibilityRole="button"
              accessibilityLabel={sp.title}
              style={({ pressed }) => [styles.spaceCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, opacity: pressed ? 0.9 : 1, ...shadows.sm }]}
            >
              <Image source={{ uri: sp.images[0] }} style={[styles.spaceThumb, { backgroundColor: colors.surfaceAlt }]} />
              <View style={{ padding: spacing.sm }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
                  {sp.title}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                  <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.xs }}>
                    {sp.isFree ? "Free" : `${formatCurrency(sp.pricePerDay)}/day`}
                  </Text>
                  <View style={[styles.spaceStatus, { backgroundColor: sp.available ? colors.success + "1A" : colors.surfaceAlt }]}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, marginRight: 4, backgroundColor: sp.available ? colors.success : colors.textMuted }} />
                    <Text style={{ color: sp.available ? colors.success : colors.textMuted, fontFamily: typography.fonts.bodyMedium, fontSize: 11 }}>
                      {sp.available ? "Active" : "Paused"}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Reserved ad slot (future sponsored ads) ── */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
          <View
            style={[
              styles.adSlot,
              { borderColor: colors.border, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg },
            ]}
          >
            <Feather name="image" size={18} color={colors.textMuted} />
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.bodySemi,
                  fontSize: typography.sizes.sm,
                }}
              >
                Ad space
              </Text>
              <Text
                style={{
                  marginTop: 1,
                  color: colors.textMuted,
                  fontFamily: typography.fonts.body,
                  fontSize: typography.sizes.xs,
                }}
              >
                Reserved for sponsored ads
              </Text>
            </View>
            <View style={[styles.adBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text
                style={{
                  color: colors.textMuted,
                  fontFamily: typography.fonts.bodySemi,
                  fontSize: 11,
                  letterSpacing: 0.5,
                }}
              >
                AD
              </Text>
            </View>
          </View>
        </View>

        {/* ── Popular near stations (vertical) ── */}
        <View style={{ marginTop: spacing.xxl, paddingHorizontal: spacing.xl }}>
          <SectionHeader
            title="Popular near stations"
            actionLabel="See all"
            onAction={() => navigation.navigate("Explore")}
          />

          {popular.loading ? (
            <View>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ marginBottom: spacing.md }}>
                  <SkeletonCard />
                </View>
              ))}
            </View>
          ) : popular.error ? (
            <ErrorState
              subtitle="We couldn't load popular spots."
              onRetry={popular.refetch}
            />
          ) : popularList.length === 0 ? (
            <EmptyState title="Nothing here yet" subtitle="Check back soon for popular spots." />
          ) : (
            popularList.map((item, index) => (
              <MotiView
                key={item.id}
                from={{ opacity: 0, translateY: 16 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "timing", duration: 360, delay: index * 60 }}
                style={{ marginBottom: spacing.md }}
              >
                <SpotCard
                  spot={item}
                  variant="list"
                  favorite={isFavorite(item.id)}
                  onToggleFavorite={() => toggle(item.id)}
                  onPress={() => openSpot(item.id)}
                />
              </MotiView>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Local sub-components                                            */
/* ────────────────────────────────────────────────────────────── */

const GRADIENT_FOR: Record<string, [string, string]> = {
  "#0FB57E": ["#12C98B", "#0A9268"],
  "#6C5CE7": ["#7F7FD5", "#6C5CE7"],
  "#FFB020": ["#FFD16B", "#FFB020"],
  "#3B82F6": ["#60A5FA", "#3B82F6"],
  "#FF5E62": ["#FF9A6B", "#FF5E62"],
};

function PromoCard({
  coupon,
  width,
  last,
  onPress,
}: {
  coupon: Coupon;
  width: number;
  last: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, typography, radius } = useTheme();
  const grad = GRADIENT_FOR[coupon.color] ?? ["#12C98B", "#0A9268"];

  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${coupon.title} coupon, code ${coupon.code}`}
      style={({ pressed }) => [
        { width, marginRight: last ? 0 : spacing.md, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <LinearGradient
        colors={grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.promo, { borderRadius: radius.lg, padding: spacing.lg }]}
      >
        <View style={styles.promoTextCol}>
          <View
            style={[
              styles.promoTag,
              { backgroundColor: "rgba(255,255,255,0.22)", borderRadius: radius.pill },
            ]}
          >
            <Ionicons name="pricetag" size={11} color={colors.white} />
            <Text
              style={{
                marginLeft: 4,
                color: colors.white,
                fontFamily: typography.fonts.bodySemi,
                fontSize: typography.sizes.xs,
                letterSpacing: 0.4,
              }}
            >
              {coupon.code}
            </Text>
          </View>

          <Text
            numberOfLines={2}
            style={{
              marginTop: spacing.sm,
              color: colors.white,
              fontFamily: typography.fonts.headingBold,
              fontSize: typography.sizes.xl,
              lineHeight: 26,
            }}
          >
            {coupon.title}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              marginTop: 4,
              color: "rgba(255,255,255,0.9)",
              fontFamily: typography.fonts.body,
              fontSize: typography.sizes.sm,
              lineHeight: 18,
            }}
          >
            {coupon.description}
          </Text>
        </View>

        <View style={styles.promoCtaRow}>
          <Text
            style={{
              color: colors.white,
              fontFamily: typography.fonts.bodySemi,
              fontSize: typography.sizes.sm,
            }}
          >
            Apply now
          </Text>
          <Ionicons name="arrow-forward-circle" size={22} color={colors.white} style={{ marginLeft: 6 }} />
        </View>

        {/* decorative circle */}
        <View style={styles.promoOrb} />
      </LinearGradient>
    </Pressable>
  );
}

function QuickAction({
  icon,
  label,
  tint,
  tintBg,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: string;
  tintBg: string;
  onPress: () => void;
}) {
  const { colors, spacing, typography, radius, shadows } = useTheme();

  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.quickItem,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.md,
          transform: [{ scale: pressed ? 0.97 : 1 }],
          ...shadows.sm,
        },
      ]}
    >
      <View style={[styles.quickIcon, { backgroundColor: tintBg, borderRadius: radius.md }]}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <Text
        numberOfLines={2}
        style={{
          marginTop: spacing.sm,
          color: colors.text,
          fontFamily: typography.fonts.bodyMedium,
          fontSize: typography.sizes.xs,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  bell: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  bellDot: {
    position: "absolute",
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  locIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 8,
    height: 54,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchTune: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  suggestPanel: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    overflow: "hidden",
  },
  suggestRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  suggestIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  suggestDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
    marginHorizontal: 12,
  },
  suggestLabel: {
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 2,
  },
  suggestEmpty: {
    alignItems: "center",
    paddingVertical: 20,
  },
  adSlot: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 16,
    minHeight: 76,
  },
  adBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  subLabel: {
    fontSize: 13,
    marginBottom: 2,
  },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  bookingsCard: {
    marginTop: 8,
    overflow: "hidden",
    paddingHorizontal: 12,
  },
  bookingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  bookingThumb: {
    width: 48,
    height: 48,
  },
  statusDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: 6,
  },
  hostHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hostHeaderIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  hostEarnCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    overflow: "hidden",
  },
  hostEarnBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  hostSubHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  requestCard: {
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  vehiclePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  requestActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  declineBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderWidth: 1,
  },
  acceptBtn: {
    flex: 1.4,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  addSpaceTile: {
    width: 130,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    minHeight: 150,
  },
  addSpaceIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  spaceCard: {
    width: 180,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  spaceThumb: {
    width: "100%",
    height: 96,
  },
  spaceStatus: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  quickItem: {
    flex: 1,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 96,
    justifyContent: "center",
  },
  quickIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  promo: {
    minHeight: 150,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  promoTextCol: {
    zIndex: 2,
  },
  promoTag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  promoCtaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    zIndex: 2,
  },
  promoOrb: {
    position: "absolute",
    right: -30,
    top: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
});
