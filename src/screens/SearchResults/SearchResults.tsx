import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/theme/ThemeContext";
import { useAsync } from "@/hooks/useAsync";
import { spotService } from "@/services/spotService";
import { bookingService } from "@/services/bookingService";
import { placesService } from "@/services/placesService";
import { distanceMeters, formatAway } from "@/utils/geo";
import { formatCurrency } from "@/utils/format";
import { haptics } from "@/utils/haptics";
import type { ParkingSpot } from "@/models/types";

import { Header } from "@/components/ui/Header";
import { LiveMap } from "@/components/ui/LiveMap";
import type { LiveMarker } from "@/components/ui/LiveMap.shared";
import { useToast } from "@/components/ui/Toast";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SearchEmpty } from "@/components/illustrations";

/** Spots further than this from the searched place are hidden. */
const NEARBY_RADIUS_M = 5000;

interface NearbySpot extends ParkingSpot {
  awayMeters: number;
}

export default function SearchResults() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, spacing, typography, radius, shadows } = useTheme();
  const toast = useToast();

  const query: string = (route.params as any)?.query ?? "";
  const paramLat: number | undefined = (route.params as any)?.latitude;
  const paramLng: number | undefined = (route.params as any)?.longitude;

  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [requestingId, setRequestingId] = useState<string | null>(null);

  // Resolve the searched place to real coordinates (already provided when the
  // user picked a suggestion; otherwise geocode the free text).
  const placeAsync = useAsync<{ lat: number; lng: number; label: string } | null>(
    async () => {
      if (typeof paramLat === "number" && typeof paramLng === "number") {
        return { lat: paramLat, lng: paramLng, label: query };
      }
      if (!query.trim()) return null;
      const places = await placesService.search(query);
      if (places.length === 0) return null;
      return {
        lat: places[0].latitude,
        lng: places[0].longitude,
        label: places[0].name,
      };
    },
    [query, paramLat, paramLng]
  );

  const spotsAsync = useAsync<ParkingSpot[]>(() => spotService.search(""), []);

  // Parking near the searched place, closest first.
  const nearby = useMemo<NearbySpot[]>(() => {
    const place = placeAsync.data;
    const spots = spotsAsync.data ?? [];
    if (!place) return [];
    return spots
      .map((s) => ({
        ...s,
        awayMeters: distanceMeters(place.lat, place.lng, s.latitude, s.longitude),
      }))
      .filter((s) => s.awayMeters <= NEARBY_RADIUS_M && s.available)
      .sort((a, b) => a.awayMeters - b.awayMeters);
  }, [placeAsync.data, spotsAsync.data]);

  const mapMarkers = useMemo<LiveMarker[]>(() => {
    const place = placeAsync.data;
    const markers: LiveMarker[] = nearby
      .slice(0, 12)
      .map((s) => ({
        latitude: s.latitude,
        longitude: s.longitude,
        title: s.title,
      }));
    if (place) {
      markers.unshift({
        latitude: place.lat,
        longitude: place.lng,
        title: place.label,
        primary: true,
      });
    }
    return markers;
  }, [placeAsync.data, nearby]);

  const loading = placeAsync.loading || spotsAsync.loading;
  const error = placeAsync.error || spotsAsync.error;

  const sendRequest = useCallback(
    async (spot: NearbySpot) => {
      setRequestingId(spot.id);
      try {
        await bookingService.create({ spotId: spot.id });
        haptics.success();
        setRequestedIds((prev) => new Set(prev).add(spot.id));
        toast.show(
          "Request sent! You'll see the host's number in Bookings once they accept.",
          "success"
        );
      } catch (e: any) {
        haptics.error();
        toast.show(e?.message ?? "Couldn't send the request.", "error");
      } finally {
        setRequestingId(null);
      }
    },
    [toast]
  );

  const openSpot = useCallback(
    (id: string) => navigation.navigate("SpotDetail", { id }),
    [navigation]
  );

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.flex, { backgroundColor: colors.bg }]}
    >
      <Header
        title={placeAsync.data?.label || query || "Nearby parking"}
        subtitle={
          loading
            ? "Finding parking near this place…"
            : `${nearby.length} parking ${nearby.length === 1 ? "spot" : "spots"} nearby`
        }
        showBack
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={{ paddingHorizontal: spacing.xl }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ marginBottom: spacing.md }}>
              <SkeletonCard />
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ErrorState
            subtitle="We couldn't run your search. Please try again."
            onRetry={() => {
              placeAsync.refetch();
              spotsAsync.refetch();
            }}
          />
        </View>
      ) : !placeAsync.data ? (
        <EmptyState
          illustration={SearchEmpty}
          title="Place not found"
          subtitle={`We couldn't find “${query}”. Try a nearby landmark, company or area name.`}
          actionLabel="Search again"
          onAction={() => navigation.goBack()}
          style={styles.empty}
        />
      ) : (
        <FlatList
          data={nearby}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.huge,
            flexGrow: 1,
          }}
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.lg }}>
              <LiveMap markers={mapMarkers} height={190} zoom={14} />
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item, index }) => {
            const requested = requestedIds.has(item.id);
            const remaining = item.remainingCount ?? item.capacity ?? 1;
            const full = remaining === 0;
            return (
              <MotiView
                from={{ opacity: 0, translateY: 14 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "timing", duration: 300, delay: Math.min(index, 6) * 45 }}
              >
                <Pressable
                  onPress={() => openSpot(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  style={({ pressed }) => [
                    styles.card,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: radius.lg,
                      opacity: pressed ? 0.93 : 1,
                      ...shadows.sm,
                    },
                  ]}
                >
                  <View style={styles.cardTop}>
                    <View style={[styles.pinBadge, { backgroundColor: colors.primaryLight, borderRadius: radius.md }]}>
                      <Ionicons name="location" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text
                        numberOfLines={1}
                        style={{ color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.md }}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={{ marginTop: 2, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}
                      >
                        {formatAway(item.awayMeters)}
                      </Text>
                    </View>
                    <Text
                      style={{ color: colors.primary, fontFamily: typography.fonts.headingBold, fontSize: typography.sizes.md }}
                    >
                      {item.isFree ? "Free" : `${formatCurrency(item.pricePerDay)}/day`}
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.sm }}>
                    <View
                      style={[
                        styles.availPill,
                        {
                          backgroundColor: full ? colors.surfaceAlt : colors.success + "1A",
                          borderRadius: radius.pill,
                        },
                      ]}
                    >
                      <Ionicons
                        name={full ? "close-circle-outline" : "checkmark-circle-outline"}
                        size={13}
                        color={full ? colors.error : colors.success}
                      />
                      <Text
                        style={{
                          marginLeft: 4,
                          color: full ? colors.error : colors.success,
                          fontFamily: typography.fonts.bodySemi,
                          fontSize: typography.sizes.xs,
                        }}
                      >
                        {full ? "Full" : `${remaining} left`}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => !full && !requested && requestingId !== item.id && sendRequest(item)}
                    disabled={full || requested || requestingId === item.id}
                    accessibilityRole="button"
                    accessibilityLabel={full ? "Currently full" : requested ? "Request sent" : "Request parking"}
                    style={({ pressed }) => [
                      styles.requestBtn,
                      {
                        backgroundColor: requested || full ? colors.surfaceAlt : colors.primary,
                        borderRadius: radius.md,
                        opacity: pressed && !full ? 0.85 : 1,
                        marginTop: spacing.md,
                      },
                    ]}
                  >
                    {requested ? (
                      <>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={{ marginLeft: 6, color: colors.textSecondary, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
                          Requested — check Bookings
                        </Text>
                      </>
                    ) : full ? (
                      <>
                        <Ionicons name="close-circle-outline" size={15} color={colors.textMuted} />
                        <Text style={{ marginLeft: 6, color: colors.textMuted, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
                          Currently full
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="paper-plane" size={15} color={colors.white} />
                        <Text style={{ marginLeft: 6, color: colors.white, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
                          {requestingId === item.id ? "Sending…" : "Request"}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </Pressable>
              </MotiView>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              illustration={SearchEmpty}
              title="No parking here yet"
              subtitle="No one has listed a space near this place so far. Know someone nearby? They can list theirs in a minute."
              actionLabel="List your space"
              onAction={() => navigation.navigate("ListSpace")}
              style={styles.empty}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  pinBadge: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  availPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  requestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  empty: {
    marginTop: 40,
  },
});
