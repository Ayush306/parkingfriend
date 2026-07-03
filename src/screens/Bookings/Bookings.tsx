import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  RefreshControl,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { Header } from "@/components/ui/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { NoBookings } from "@/components/illustrations/NoBookings";

import { useTheme } from "@/theme/ThemeContext";
import { useAsync } from "@/hooks/useAsync";
import { bookingService } from "@/services/bookingService";
import type { Booking } from "@/models/types";
import { formatCurrency, formatDate } from "@/utils/format";
import { haptics } from "@/utils/haptics";

const TABS = ["Upcoming", "Active", "Completed", "Cancelled"] as const;
type TabLabel = (typeof TABS)[number];

const TAB_STATUS: Record<TabLabel, Booking["status"][]> = {
  Upcoming: ["confirmed", "pending"],
  Active: ["active"],
  Completed: ["completed"],
  Cancelled: ["cancelled"],
};

const STATUS_TONE: Record<
  Booking["status"],
  "primary" | "success" | "warning" | "error" | "neutral"
> = {
  pending: "warning",
  confirmed: "primary",
  active: "success",
  completed: "neutral",
  cancelled: "error",
};

const STATUS_LABEL: Record<Booking["status"], string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Renders a "HH:mm" 24h string as friendly 12h label. */
function label12h(hhmm?: string): string {
  if (!hhmm) return "--";
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const meridiem = h >= 12 ? "PM" : "AM";
  let hour = h % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${(m || 0).toString().padStart(2, "0")} ${meridiem}`;
}

const EMPTY_COPY: Record<TabLabel, { title: string; subtitle: string }> = {
  Upcoming: {
    title: "No upcoming bookings",
    subtitle: "Book a parking spot near your station and it will show up here.",
  },
  Active: {
    title: "Nothing active right now",
    subtitle: "Your ongoing parking sessions will appear here.",
  },
  Completed: {
    title: "No completed trips yet",
    subtitle: "Past bookings you've wrapped up will be listed here.",
  },
  Cancelled: {
    title: "No cancelled bookings",
    subtitle: "Bookings you cancel will be kept here for reference.",
  },
};

export default function Bookings() {
  const navigation = useNavigation<any>();
  const { colors, spacing, typography, radius } = useTheme();

  const { data, loading, error, refetch } = useAsync<Booking[]>(
    () => bookingService.list(),
    []
  );

  const [tab, setTab] = useState<TabLabel>("Upcoming");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.light();
    await Promise.resolve(refetch());
    // Give the visible refresh spinner a beat.
    setTimeout(() => setRefreshing(false), 650);
  }, [refetch]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const wanted = TAB_STATUS[tab];
    return data.filter((b) => wanted.includes(b.status));
  }, [data, tab]);

  const openBooking = (b: Booking) => {
    navigation.navigate("BookingDetail", { id: b.id });
  };

  const renderItem = useCallback(
    ({ item, index }: { item: Booking; index: number }) => (
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 300, delay: Math.min(index, 6) * 55 }}
        style={{ marginBottom: spacing.md }}
      >
        <Card padded={false} onPress={() => openBooking(item)} style={{ overflow: "hidden" }}>
          <View style={{ flexDirection: "row", padding: spacing.md }}>
            <Image
              source={{ uri: item.spot.images[0] }}
              style={{
                width: 82,
                height: 82,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceAlt,
              }}
            />
            <View style={{ flex: 1, marginLeft: spacing.md, justifyContent: "space-between" }}>
              <View style={styles.rowBetween}>
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, marginRight: spacing.sm, color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.md }}
                >
                  {item.spot.title}
                </Text>
                <Badge label={STATUS_LABEL[item.status]} tone={STATUS_TONE[item.status]} size="sm" />
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
                <Text style={{ marginLeft: 4, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}>
                  {formatDate(item.date, { withWeekday: true, withYear: false })}
                </Text>
                <Text style={{ marginHorizontal: 6, color: colors.border }}>|</Text>
                <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                <Text style={{ marginLeft: 4, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}>
                  {label12h(item.startTime)}
                </Text>
              </View>

              <View style={styles.rowBetween}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                  <Text
                    numberOfLines={1}
                    style={{ marginLeft: 4, flex: 1, color: colors.textMuted, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}
                  >
                    {item.spot.area}
                  </Text>
                </View>
                <Text style={{ color: colors.text, fontFamily: typography.fonts.headingBold, fontSize: typography.sizes.md }}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            </View>
          </View>
        </Card>
      </MotiView>
    ),
    [colors, spacing, typography, radius]
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]} edges={["top", "left", "right"]}>
      <Header title="My bookings" large />

      <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.md }}>
        <SegmentedControl
          options={[...TABS]}
          value={tab}
          onChange={(v) => setTab(v as TabLabel)}
        />
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: spacing.xl }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ marginBottom: spacing.md }}>
              <SkeletonCard />
            </View>
          ))}
        </View>
      ) : error ? (
        <ErrorState onRetry={refetch} style={{ flex: 1 }} />
      ) : filtered.length === 0 ? (
        <FlatList<Booking>
          data={[]}
          renderItem={() => null}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.surface}
            />
          }
          ListEmptyComponent={
            <EmptyState
              illustration={NoBookings}
              title={EMPTY_COPY[tab].title}
              subtitle={EMPTY_COPY[tab].subtitle}
              actionLabel={tab === "Upcoming" ? "Find parking" : undefined}
              onAction={
                tab === "Upcoming"
                  ? () => navigation.navigate("Main", { screen: "Explore" })
                  : undefined
              }
            />
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.xxxl,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.surface}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
