import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Linking,
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
import { CancelReasonSheet } from "@/components/ui/CancelReasonSheet";
import { PendingRatings } from "@/components/ui/PendingRatings";
import { useToast } from "@/components/ui/Toast";

import { useTheme } from "@/theme/ThemeContext";
import { useAsync } from "@/hooks/useAsync";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { bookingService } from "@/services/bookingService";
import type { Booking } from "@/models/types";
import { formatCurrency, formatDate } from "@/utils/format";
import { haptics } from "@/utils/haptics";

const TABS = ["Requested", "Accepted", "Past"] as const;
type TabLabel = (typeof TABS)[number];

const TAB_STATUS: Record<TabLabel, Booking["status"][]> = {
  Requested: ["pending"],
  Accepted: ["confirmed", "active"],
  Past: ["completed", "cancelled"],
};

const STATUS_TONE: Record<
  Booking["status"],
  "primary" | "success" | "warning" | "error" | "neutral"
> = {
  pending: "warning",
  confirmed: "success",
  active: "success",
  completed: "neutral",
  cancelled: "error",
};

const STATUS_LABEL: Record<Booking["status"], string> = {
  pending: "Requested",
  confirmed: "Accepted",
  active: "Active",
  completed: "Completed",
  cancelled: "Declined",
};

const EMPTY_COPY: Record<TabLabel, { title: string; subtitle: string }> = {
  Requested: {
    title: "No requests yet",
    subtitle:
      "Search a place and tap Request on any parking nearby — your requests will show up here.",
  },
  Accepted: {
    title: "Nothing accepted yet",
    subtitle:
      "When a host accepts your request, their phone number appears here so you can call them.",
  },
  Past: {
    title: "No past requests",
    subtitle: "Completed and declined requests are kept here for reference.",
  },
};

export default function Bookings() {
  const navigation = useNavigation<any>();
  const { colors, spacing, typography, radius } = useTheme();
  const toast = useToast();

  const { data, loading, error, refetch, refetchSilent } = useAsync<Booking[]>(
    () => bookingService.list(),
    []
  );

  // The host's accept/decline shows up here (with their phone number) without
  // the driver doing anything — via a silent, no-flicker background refresh on
  // focus, then gently while viewing (paused when the app is backgrounded).
  useLiveRefresh(refetchSilent, 30000);

  const [tab, setTab] = useState<TabLabel>("Requested");
  const [refreshing, setRefreshing] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);

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

  const callHost = useCallback(
    (phone: string) => {
      haptics.light();
      Linking.openURL(`tel:${phone.replace(/\s+/g, "")}`).catch(() =>
        toast.show("Couldn't open the dialer on this device.", "error")
      );
    },
    [toast]
  );

  const openCancel = useCallback((b: Booking) => {
    haptics.warning();
    setCancelTarget(b);
  }, []);

  const doCancel = useCallback(
    async (reason: string) => {
      if (!cancelTarget) return;
      setCancelling(true);
      try {
        await bookingService.cancel(cancelTarget.id, reason);
        setCancelTarget(null);
        haptics.success();
        toast.show("Booking cancelled. Your spot has been released.", "success");
        refetchSilent();
      } catch (e: any) {
        haptics.error();
        toast.show(e?.message ?? "Couldn't cancel this booking.", "error");
      } finally {
        setCancelling(false);
      }
    },
    [cancelTarget, toast, refetchSilent]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Booking; index: number }) => (
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 300, delay: Math.min(index, 6) * 55 }}
        style={{ marginBottom: spacing.md }}
      >
        <Card onPress={() => openBooking(item)}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: spacing.sm }}>
              <View style={[styles.pinBadge, { backgroundColor: colors.primaryLight, borderRadius: radius.md }]}>
                <Ionicons name="location" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text
                  numberOfLines={1}
                  style={{ color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.md }}
                >
                  {item.spot.title}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ marginTop: 2, color: colors.textMuted, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}
                >
                  {formatDate(item.date, { withWeekday: true, withYear: false })}
                  {item.spot.area ? ` · ${item.spot.area}` : ""}
                </Text>
              </View>
            </View>
            <Badge label={STATUS_LABEL[item.status]} tone={STATUS_TONE[item.status]} size="sm" />
          </View>

          <View style={[styles.rowBetween, { marginTop: spacing.md }]}>
            <Text style={{ color: colors.text, fontFamily: typography.fonts.headingBold, fontSize: typography.sizes.md }}>
              {item.spot.isFree ? "Free" : `${formatCurrency(item.amount)}/day`}
            </Text>
            <Text style={{ color: colors.textMuted, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}>
              Pay the host directly
            </Text>
          </View>

          {/* The whole point: phone appears only after the host accepts. */}
          {item.contactUnlocked && item.hostPhone ? (
            <Pressable
              onPress={() => callHost(item.hostPhone!)}
              accessibilityRole="button"
              accessibilityLabel={`Call host at ${item.hostPhone}`}
              style={({ pressed }) => [
                styles.callRow,
                { backgroundColor: colors.primary, borderRadius: radius.md, marginTop: spacing.md, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name="call" size={16} color={colors.white} />
              <Text style={{ marginLeft: 8, color: colors.white, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
                Call host · {item.hostPhone}
              </Text>
            </Pressable>
          ) : item.status === "pending" ? (
            <View
              style={[
                styles.callRow,
                { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, marginTop: spacing.md },
              ]}
            >
              <Ionicons name="hourglass-outline" size={15} color={colors.textSecondary} />
              <Text style={{ marginLeft: 8, flex: 1, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}>
                Waiting for the host to accept — their number appears here after.
              </Text>
            </View>
          ) : null}

          {/* Cancel anytime while pending or accepted (asks for a reason). */}
          {item.status === "pending" || item.status === "confirmed" ? (
            <Pressable
              onPress={() => openCancel(item)}
              accessibilityRole="button"
              accessibilityLabel={item.status === "pending" ? "Cancel request" : "Cancel booking"}
              hitSlop={6}
              style={({ pressed }) => [styles.cancelLink, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="close-circle-outline" size={15} color={colors.error} />
              <Text style={{ marginLeft: 5, color: colors.error, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.xs }}>
                {item.status === "pending" ? "Cancel request" : "Cancel booking"}
              </Text>
            </Pressable>
          ) : null}
        </Card>
      </MotiView>
    ),
    [colors, spacing, typography, radius, callHost, openCancel]
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]} edges={["top", "left", "right"]}>
      <Header title="My bookings" large />

      <View style={{ paddingHorizontal: spacing.xl }}>
        <PendingRatings role="driver" />
      </View>

      <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md, marginBottom: spacing.md }}>
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
              actionLabel={tab === "Requested" ? "Find parking" : undefined}
              onAction={
                tab === "Requested"
                  ? () => navigation.navigate("Explore")
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

      <CancelReasonSheet
        visible={!!cancelTarget}
        title={
          cancelTarget?.status === "pending"
            ? "Cancel this request?"
            : "Cancel this booking?"
        }
        subtitle="Your spot will be released. Please pick a reason so we can help."
        confirmLabel="Yes, cancel"
        keepLabel="Keep it"
        loading={cancelling}
        onConfirm={doCancel}
        onClose={() => !cancelling && setCancelTarget(null)}
      />
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
  pinBadge: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  callRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  cancelLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 12,
    paddingVertical: 4,
  },
});
