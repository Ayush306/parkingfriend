import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  Image,
  TextInput,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { MotiView } from "moti";

import { useTheme } from "@/theme/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { haptics } from "@/utils/haptics";
import { bookingService } from "@/services/bookingService";
import { placesService, type Place } from "@/services/placesService";
import { formatDate } from "@/utils/format";

import { Avatar } from "@/components/ui/Avatar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SkeletonCard } from "@/components/ui/Skeleton";
import type { Booking } from "@/models/types";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const navigation = useNavigation<any>();
  const { colors, spacing, typography, radius, shadows } = useTheme();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const debouncedQuery = useDebounce(query, 350);

  const recentBookings = useAsync<Booking[]>(() => bookingService.list(), []);

  // Real place lookup — type any place, company, landmark or area name.
  const placeResults = useAsync<Place[]>(
    () => placesService.search(debouncedQuery),
    [debouncedQuery]
  );

  const firstName = useMemo(() => {
    const name = user?.name?.trim() || "there";
    return name.split(" ")[0];
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    recentBookings.refetch();
    // brief guard so the spinner shows while services resolve
    setTimeout(() => setRefreshing(false), 900);
  }, [recentBookings]);

  const closeSearch = useCallback(() => {
    setSearchFocused(false);
    Keyboard.dismiss();
  }, []);

  /** Open nearby-parking results for a picked real place. */
  const openPlace = useCallback(
    (place: Place) => {
      haptics.selection();
      closeSearch();
      setQuery("");
      navigation.navigate("SearchResults", {
        query: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
      });
    },
    [closeSearch, navigation]
  );

  /** Free-text submit — SearchResults geocodes it itself. */
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

  const searchResults = placeResults.data ?? [];

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
                {query.trim().length >= 2 ? "Places" : "Type a place, company or landmark"}
              </Text>

              {query.trim().length < 2 ? null : placeResults.loading ? (
                <View style={styles.suggestEmpty}>
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontFamily: typography.fonts.body,
                      fontSize: typography.sizes.sm,
                    }}
                  >
                    Finding places…
                  </Text>
                </View>
              ) : searchResults.length === 0 ? (
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
                    No places match “{query.trim()}”
                  </Text>
                </View>
              ) : (
                searchResults.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => openPlace(item)}
                    accessibilityRole="button"
                    accessibilityLabel={item.name}
                    style={({ pressed }) => [styles.suggestRow, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <View style={[styles.suggestIcon, { backgroundColor: colors.surfaceAlt }]}>
                      <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
                    </View>
                    <View style={styles.flex}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: colors.text,
                          fontFamily: typography.fonts.bodyMedium,
                          fontSize: typography.sizes.sm,
                        }}
                      >
                        {item.name}
                      </Text>
                      {item.label ? (
                        <Text
                          numberOfLines={1}
                          style={{
                            marginTop: 1,
                            color: colors.textMuted,
                            fontFamily: typography.fonts.body,
                            fontSize: typography.sizes.xs,
                          }}
                        >
                          {item.label}
                        </Text>
                      ) : null}
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

        {/* ── Recent bookings ── */}
        <View style={{ marginTop: spacing.xxl, paddingHorizontal: spacing.xl }}>
          <SectionHeader
            title="Your bookings"
            actionLabel="See all"
            onAction={() => navigation.navigate("Bookings")}
          />

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
                No requests yet. Search a place and request a spot near it.
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

      </ScrollView>
    </SafeAreaView>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Local sub-components                                            */
/* ────────────────────────────────────────────────────────────── */


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
});
