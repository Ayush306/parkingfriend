import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  Image,
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
import { formatCurrency, formatDate } from "@/utils/format";

import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import type { HostRequest, ParkingSpot, WalletSummary } from "@/models/types";

export default function Post() {
  const navigation = useNavigation<any>();
  const { colors, spacing, typography, radius, shadows, gradients } = useTheme();
  const toast = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const earnings = useAsync<WalletSummary>(() => walletService.getSummary(), []);
  const listings = useAsync<ParkingSpot[]>(() => hostService.getListings(), []);
  const requests = useAsync<HostRequest[]>(() => hostService.getRequests(), []);

  // Incoming requests must appear without any manual action: refetch on every
  // focus and poll while the host is looking at this screen.
  useLiveRefresh(requests.refetch, 15000);
  useLiveRefresh(() => {
    listings.refetch();
    earnings.refetch();
  }, 0);

  const pendingRequests = (requests.data ?? []).filter(
    (r) => r.status === "pending"
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

  const respondToRequest = async (id: string, accept: boolean) => {
    setRespondingId(id);
    try {
      await hostService.respond(id, accept);
      haptics.success();
      toast.show(
        accept ? "Request accepted — contact shared." : "Request declined.",
        accept ? "success" : "info"
      );
      requests.refetch();
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

        {/* Earnings strip */}
        <Pressable
          onPress={() => {
            haptics.light();
            navigation.navigate("Wallet");
          }}
          accessibilityRole="button"
          accessibilityLabel="Host earnings"
          style={({ pressed }) => [{ marginTop: spacing.md, opacity: pressed ? 0.92 : 1, borderRadius: radius.lg, ...shadows.sm }]}
        >
          <View style={[styles.earnCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
            <View style={[styles.earnIcon, { backgroundColor: colors.primaryLight, borderRadius: radius.md }]}>
              <Ionicons name="trending-up" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.bodyMedium, fontSize: typography.sizes.xs }}>
                Earned as a host
              </Text>
              <Text style={{ marginTop: 1, color: colors.text, fontFamily: typography.fonts.headingBold, fontSize: typography.sizes.xl }}>
                {formatCurrency(earnings.data?.earningsLifetime ?? 0)}
              </Text>
              <Text style={{ marginTop: 1, color: colors.textMuted, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}>
                +{formatCurrency(earnings.data?.earningsLast3Months ?? 0)} in the last 3 months
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Pressable>

        {/* Incoming requests */}
        <View style={styles.subHeaderRow}>
          <Text style={[styles.subLabel, { color: colors.text, fontFamily: typography.fonts.heading, fontSize: typography.sizes.md }]}>
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

        {requests.loading ? (
          <View style={[styles.emptyRow, { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, marginTop: spacing.sm }]}>
            <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}>
              Loading requests…
            </Text>
          </View>
        ) : pendingRequests.length === 0 ? (
          <View style={[styles.emptyRow, { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, marginTop: spacing.sm }]}>
            <Ionicons name="checkmark-done-outline" size={18} color={colors.textMuted} />
            <Text style={{ marginLeft: spacing.sm, flex: 1, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}>
              No pending requests right now.
            </Text>
          </View>
        ) : (
          pendingRequests.slice(0, 4).map((r) => (
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
                  <Ionicons name={r.vehicleType === "bike" || r.vehicleType === "bicycle" ? "bicycle-outline" : "car-outline"} size={12} color={colors.textSecondary} />
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

        {pendingRequests.length > 4 ? (
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

        {/* Your spaces */}
        <View style={styles.subHeaderRow}>
          <Text style={[styles.subLabel, { color: colors.text, fontFamily: typography.fonts.heading, fontSize: typography.sizes.md }]}>
            Your spaces{listings.data ? ` · ${listings.data.length}` : ""}
          </Text>
        </View>

        {(listings.data ?? []).length === 0 ? (
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
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                    <View style={[styles.spaceStatus, { backgroundColor: (sp.remainingCount ?? sp.capacity ?? 1) > 0 ? colors.primaryLight : colors.surfaceAlt }]}>
                      <Ionicons
                        name="car-outline"
                        size={11}
                        color={(sp.remainingCount ?? sp.capacity ?? 1) > 0 ? colors.primary : colors.textMuted}
                        style={{ marginRight: 3 }}
                      />
                      <Text style={{ color: (sp.remainingCount ?? sp.capacity ?? 1) > 0 ? colors.primary : colors.textMuted, fontFamily: typography.fonts.bodyMedium, fontSize: 11 }}>
                        {sp.remainingCount ?? sp.capacity ?? 1}/{sp.capacity ?? 1} free
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </ScrollView>
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
  earnCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  earnIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
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
});
