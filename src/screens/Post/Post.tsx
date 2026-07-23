import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";

import { useTheme } from "@/theme/ThemeContext";
import { useAsync } from "@/hooks/useAsync";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { haptics } from "@/utils/haptics";
import { hostService } from "@/services/hostService";
import { walletService } from "@/services/walletService";
import { formatCurrency } from "@/utils/format";

import { SpotGraphic } from "@/components/ui/SpotGraphic";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CancelReasonSheet, HOST_CANCEL_REASONS } from "@/components/ui/CancelReasonSheet";
import { PendingRatings } from "@/components/ui/PendingRatings";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TabSwipe } from "@/components/ui/TabSwipe";
import { HostRequestCard } from "@/components/host/HostRequestCard";
import { useToast } from "@/components/ui/Toast";
import type { HostRequest, ParkingSpot, WalletSummary } from "@/models/types";

/**
 * My Space — the host's whole world on ONE page, top to bottom:
 *   1. List a new space (the primary action)
 *   2. Summary card: earned as host · spaces published · guests accepted
 *   3. Your spaces (manage / remove)
 *   4. Booking requests with Pending / Accepted / All tabs INLINE — accept,
 *      decline, message, call and cancel right here. No extra screen hop.
 */

const REQ_TABS = ["Pending", "Accepted", "All"] as const;
type ReqTab = (typeof REQ_TABS)[number];

export default function Post() {
  const navigation = useNavigation<any>();
  const { colors, spacing, typography, radius, shadows, gradients } = useTheme();
  const toast = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ParkingSpot | null>(null);
  const [removing, setRemoving] = useState(false);
  const [reqTab, setReqTab] = useState<ReqTab>("Pending");
  const [cancelTarget, setCancelTarget] = useState<HostRequest | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const earnings = useAsync<WalletSummary>(() => walletService.getSummary(), []);
  const listings = useAsync<ParkingSpot[]>(() => hostService.getListings(), []);
  const requests = useAsync<HostRequest[]>(() => hostService.getRequests(), []);

  // Incoming requests stay current WITHOUT a visible reload: refresh on focus,
  // then a silent 30s background refresh while this screen is in front (paused
  // when the app is backgrounded). Listings/earnings only refresh on focus.
  useLiveRefresh(requests.refetchSilent, 30000);
  useLiveRefresh(() => {
    listings.refetchSilent();
    earnings.refetchSilent();
  }, 0);

  const allRequests = requests.data ?? [];
  const pendingCount = useMemo(
    () => allRequests.filter((r) => r.status === "pending").length,
    [allRequests]
  );
  const acceptedCount = useMemo(
    () => allRequests.filter((r) => r.status === "accepted").length,
    [allRequests]
  );

  const filteredRequests = useMemo(() => {
    if (reqTab === "Pending") return allRequests.filter((r) => r.status === "pending");
    if (reqTab === "Accepted") return allRequests.filter((r) => r.status === "accepted");
    return allRequests;
  }, [allRequests, reqTab]);

  // Swipe left/right moves between the request tabs (clamped at the ends).
  // Haptic only when the tab really changes — no buzz at the first/last tab.
  const shiftTab = useCallback(
    (dir: 1 | -1) => {
      const idx = REQ_TABS.indexOf(reqTab);
      const next = REQ_TABS[Math.min(REQ_TABS.length - 1, Math.max(0, idx + dir))];
      if (next !== reqTab) {
        haptics.light();
        setReqTab(next);
      }
    },
    [reqTab]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    earnings.refetch();
    listings.refetch();
    requests.refetch();
    setTimeout(() => setRefreshing(false), 900);
  }, [earnings, listings, requests]);

  const openSpot = useCallback(
    (id: string) => navigation.navigate("SpotDetail", { id }),
    [navigation]
  );

  const openChat = useCallback(
    (r: HostRequest) => {
      if (!r.bookingId) return;
      haptics.light();
      navigation.navigate("Chat", { bookingId: r.bookingId, spotTitle: r.spotTitle });
    },
    [navigation]
  );

  const removeListing = async () => {
    if (!removeTarget || removing) return;
    setRemoving(true);
    try {
      const { cancelledBookings } = await hostService.deleteListing(removeTarget.id);
      setRemoveTarget(null);
      haptics.success();
      toast.show(
        cancelledBookings > 0
          ? `Listing removed. ${cancelledBookings} booking${cancelledBookings === 1 ? "" : "s"} cancelled.`
          : "Listing removed.",
        "success"
      );
      listings.refetch();
      requests.refetch();
    } catch (e: any) {
      haptics.error();
      toast.show(e?.message ?? "Couldn't remove this listing.", "error");
    } finally {
      setRemoving(false);
    }
  };

  const respondToRequest = async (id: string, accept: boolean) => {
    if (respondingId) return;
    setRespondingId(id);
    try {
      const updated = await hostService.respond(id, accept);
      // Apply the result before clearing busy, so the card flips to its new
      // state in the same render — no window where a stale Pending card still
      // shows live Accept/Decline (which would 409 on a second tap).
      requests.setData((prev) =>
        (prev ?? []).map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
      );
      haptics.success();
      toast.show(
        accept ? "Request accepted — contact shared." : "Request declined.",
        accept ? "success" : "info"
      );
    } catch (e: any) {
      haptics.error();
      toast.show(e?.message ?? "Couldn't update the request.", "error");
      requests.refetchSilent();
    } finally {
      setRespondingId(null);
    }
  };

  // Host cancels a booking they had ALREADY accepted — asks for a reason
  // first, then the driver is notified immediately and the slot frees up.
  const doCancelAccepted = async (reason: string) => {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    try {
      const updated = await hostService.cancelAccepted(cancelTarget.id, reason);
      // Flip the card to Cancelled in the same render that clears busy — no
      // window where the stale card still offers "Cancel booking" again.
      requests.setData((prev) =>
        (prev ?? []).map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
      );
      setCancelTarget(null);
      haptics.success();
      toast.show("Booking cancelled — the driver has been notified.", "success");
    } catch (e: any) {
      haptics.error();
      toast.show(e?.message ?? "Couldn't cancel this booking.", "error");
      requests.refetchSilent();
    } finally {
      setCancelling(false);
    }
  };

  const emptyCopy: Record<ReqTab, string> = {
    Pending: "No pending requests right now — new ones appear here the moment a driver asks.",
    Accepted: "Nothing accepted yet. Accept a pending request and your confirmed guests show here.",
    All: "When drivers request your spots, every request (and its history) shows up here.",
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.flex, { backgroundColor: colors.bg }]}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: spacing.huge, paddingHorizontal: spacing.xl }}
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
      >
        {/* Title */}
        <MotiView
          from={{ opacity: 0, translateY: -8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 320 }}
          style={{ paddingTop: 8 }}
        >
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fonts.headingBold,
              fontSize: typography.sizes.xxl,
            }}
          >
            My Space
          </Text>
          <Text
            style={{
              marginTop: 2,
              color: colors.textSecondary,
              fontFamily: typography.fonts.body,
              fontSize: typography.sizes.sm,
            }}
          >
            List and manage your parking
          </Text>
        </MotiView>

        {/* Primary CTA — list a new space (add a host) */}
        <Pressable
          onPress={() => {
            haptics.light();
            navigation.navigate("ListSpace");
          }}
          accessibilityRole="button"
          accessibilityLabel="List a new space"
          style={({ pressed }) => [{ marginTop: spacing.lg, opacity: pressed ? 0.92 : 1, borderRadius: radius.lg, ...shadows.md }]}
        >
          <LinearGradient
            colors={gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.ctaCard, { borderRadius: radius.lg }]}
          >
            <View style={[styles.ctaIcon, { borderRadius: radius.pill }]}>
              <Ionicons name="add" size={26} color={colors.white} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={{ color: "#FFFFFF", fontFamily: typography.fonts.heading, fontSize: typography.sizes.lg }}>
                List a new space
              </Text>
              <Text style={{ marginTop: 2, color: "rgba(255,255,255,0.9)", fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}>
                Pin it on the map — takes under a minute
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>

        {/* Host summary — earnings, live spaces, accepted guests. One glance. */}
        <Pressable
          onPress={() => {
            haptics.light();
            navigation.navigate("Wallet");
          }}
          accessibilityRole="button"
          accessibilityLabel="Host summary — tap for earnings history"
          style={({ pressed }) => [{ marginTop: spacing.md, opacity: pressed ? 0.92 : 1, borderRadius: radius.lg, ...shadows.sm }]}
        >
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
            <View style={styles.summaryCol}>
              <View style={[styles.summaryIcon, { backgroundColor: colors.primaryLight, borderRadius: radius.md }]}>
                <Ionicons name="trending-up" size={16} color={colors.primary} />
              </View>
              <Text style={{ marginTop: 6, color: colors.text, fontFamily: typography.fonts.headingBold, fontSize: typography.sizes.lg }} numberOfLines={1}>
                {formatCurrency(earnings.data?.earningsLifetime ?? 0)}
              </Text>
              <Text style={{ marginTop: 1, color: colors.textSecondary, fontFamily: typography.fonts.bodyMedium, fontSize: typography.sizes.xs }}>
                Earned as host
              </Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryCol}>
              <View style={[styles.summaryIcon, { backgroundColor: colors.primaryLight, borderRadius: radius.md }]}>
                <Ionicons name="home-outline" size={16} color={colors.primary} />
              </View>
              <Text style={{ marginTop: 6, color: colors.text, fontFamily: typography.fonts.headingBold, fontSize: typography.sizes.lg }}>
                {listings.data?.length ?? 0}
              </Text>
              <Text style={{ marginTop: 1, color: colors.textSecondary, fontFamily: typography.fonts.bodyMedium, fontSize: typography.sizes.xs }}>
                Spaces listed
              </Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryCol}>
              <View style={[styles.summaryIcon, { backgroundColor: colors.primaryLight, borderRadius: radius.md }]}>
                <Ionicons name="people-outline" size={16} color={colors.primary} />
              </View>
              <Text style={{ marginTop: 6, color: colors.text, fontFamily: typography.fonts.headingBold, fontSize: typography.sizes.lg }}>
                {acceptedCount}
              </Text>
              <Text style={{ marginTop: 1, color: colors.textSecondary, fontFamily: typography.fonts.bodyMedium, fontSize: typography.sizes.xs }}>
                Guests accepted
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Rate guests whose parking has finished */}
        <PendingRatings role="host" />

        {/* Your spaces */}
        <View style={styles.subHeaderRow}>
          <Text style={[styles.subLabel, { color: colors.text, fontFamily: typography.fonts.heading, fontSize: typography.sizes.md }]}>
            Your spaces{listings.data ? ` · ${listings.data.length}` : ""}
          </Text>
        </View>

        {!listings.data && listings.error ? (
          <Pressable
            onPress={() => listings.refetch()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading your spaces"
            style={[styles.emptyRow, { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, marginTop: spacing.sm }]}
          >
            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
            <Text style={{ marginLeft: spacing.sm, flex: 1, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}>
              Couldn't load your spaces.
            </Text>
            <Text style={{ color: colors.primary, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
              Retry
            </Text>
          </Pressable>
        ) : (listings.data ?? []).length === 0 ? (
          <View style={[styles.emptyRow, { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, marginTop: spacing.sm }]}>
            <Ionicons name="home-outline" size={18} color={colors.textMuted} />
            <Text style={{ marginLeft: spacing.sm, flex: 1, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}>
              You haven't listed a space yet. Tap "List a new space" above to add one.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.md, paddingTop: spacing.sm }}
          >
            {(listings.data ?? []).map((sp) => (
              <Pressable
                key={sp.id}
                onPress={() => openSpot(sp.id)}
                accessibilityRole="button"
                accessibilityLabel={sp.title}
                style={({ pressed }) => [styles.spaceCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, opacity: pressed ? 0.9 : 1, ...shadows.sm }]}
              >
                {sp.images[0] ? (
                  <Image source={{ uri: sp.images[0] }} style={[styles.spaceThumb, { backgroundColor: colors.surfaceAlt }]} />
                ) : (
                  <SpotGraphic vehicleTypes={sp.vehicleTypes} iconSize={30} style={styles.spaceThumb} />
                )}
                {/* Remove this listing (host-only, no reason asked) */}
                <Pressable
                  onPress={() => {
                    haptics.warning();
                    setRemoveTarget(sp);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${sp.title}`}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.removeBtn,
                    { backgroundColor: colors.overlay, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="trash-outline" size={15} color={colors.white} />
                </Pressable>
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
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6 }}>
                    <View style={[styles.spaceStatus, { backgroundColor: (sp.remainingCount ?? sp.capacity ?? 1) > 0 ? colors.primaryLight : colors.surfaceAlt }]}>
                      <Ionicons
                        name="car-outline"
                        size={11}
                        color={(sp.remainingCount ?? sp.capacity ?? 1) > 0 ? colors.primary : colors.textMuted}
                        style={{ marginRight: 3 }}
                      />
                      <Text style={{ color: (sp.remainingCount ?? sp.capacity ?? 1) > 0 ? colors.primary : colors.textMuted, fontFamily: typography.fonts.bodyMedium, fontSize: 11 }}>
                        {sp.remainingCount ?? sp.capacity ?? 1}/{sp.capacity ?? 1} available
                      </Text>
                    </View>
                    <View style={[styles.spaceStatus, { backgroundColor: colors.surfaceAlt }]}>
                      <Ionicons name="eye-outline" size={11} color={colors.textSecondary} style={{ marginRight: 3 }} />
                      <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.bodyMedium, fontSize: 11 }}>
                        {sp.views ?? 0} {(sp.views ?? 0) === 1 ? "view" : "views"}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Booking requests — the host's inbox, right here with tabs */}
        <View style={styles.subHeaderRow}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={[styles.subLabel, { color: colors.text, fontFamily: typography.fonts.heading, fontSize: typography.sizes.md }]}>
              Booking requests
            </Text>
            {pendingCount > 0 ? (
              <View style={[styles.countPill, { backgroundColor: colors.primaryLight, marginLeft: 8 }]}>
                <Text style={{ color: colors.primary, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.xs }}>
                  {pendingCount} new
                </Text>
              </View>
            ) : null}
            {/* Every tab switch re-fetches — this makes that visible. */}
            {requests.refreshing ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
            ) : null}
          </View>
        </View>

        {/* Swipe left/right anywhere below to switch between the tabs. */}
        <TabSwipe
          onNext={() => shiftTab(1)}
          onPrev={() => shiftTab(-1)}
          style={{ minHeight: 220 }}
        >
          <View style={{ marginTop: spacing.sm }}>
            <SegmentedControl
              options={[...REQ_TABS]}
              value={reqTab}
              onChange={(v) => setReqTab(v as ReqTab)}
            />
          </View>

          {requests.loading && !requests.data ? (
            <View style={[styles.emptyRow, { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, marginTop: spacing.md }]}>
              <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}>
                Loading requests…
              </Text>
            </View>
          ) : requests.error && !requests.data ? (
            <Pressable
              onPress={() => requests.refetch()}
              accessibilityRole="button"
              accessibilityLabel="Retry loading requests"
              style={[styles.emptyRow, { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, marginTop: spacing.md }]}
            >
              <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={{ marginLeft: spacing.sm, flex: 1, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}>
                Couldn't load requests.
              </Text>
              <Text style={{ color: colors.primary, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
                Retry
              </Text>
            </Pressable>
          ) : filteredRequests.length === 0 ? (
            <View style={[styles.emptyRow, { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, marginTop: spacing.md }]}>
              <Ionicons name="checkmark-done-outline" size={18} color={colors.textMuted} />
              <Text style={{ marginLeft: spacing.sm, flex: 1, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}>
                {emptyCopy[reqTab]}
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: spacing.md }}>
              {filteredRequests.map((r, i) => (
                <HostRequestCard
                  key={r.id}
                  request={r}
                  index={i}
                  busy={respondingId === r.id}
                  onRespond={(accept) => respondToRequest(r.id, accept)}
                  onMessage={() => openChat(r)}
                  onCancel={() => {
                    haptics.warning();
                    setCancelTarget(r);
                  }}
                />
              ))}
            </View>
          )}
        </TabSwipe>
      </ScrollView>

      <ConfirmDialog
        visible={!!removeTarget}
        title="Remove this listing?"
        message={
          "It will disappear from the map and any current bookings on it will be cancelled. This can't be undone."
        }
        confirmLabel={removing ? "Removing…" : "Remove listing"}
        cancelLabel="Keep it"
        tone="danger"
        onConfirm={removeListing}
        onCancel={() => !removing && setRemoveTarget(null)}
      />

      {/* Host cancels an ACCEPTED booking — reason first, driver notified. */}
      <CancelReasonSheet
        visible={!!cancelTarget}
        title="Cancel this booking?"
        subtitle={`${cancelTarget?.requesterName ?? "The driver"} will be told immediately. Please pick a reason.`}
        reasons={HOST_CANCEL_REASONS}
        confirmLabel="Yes, cancel booking"
        keepLabel="Keep the booking"
        loading={cancelling}
        onConfirm={doCancelAccepted}
        onClose={() => !cancelling && setCancelTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  ctaCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    overflow: "hidden",
  },
  ctaIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "stretch",
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  subHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
  },
  subLabel: {
    marginBottom: 0,
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
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
  removeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  spaceStatus: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
});
