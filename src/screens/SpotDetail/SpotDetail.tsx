import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  Pressable,
  ScrollView,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";

import { useTheme } from "@/theme/ThemeContext";
import { useAsync } from "@/hooks/useAsync";
import { useFavorites } from "@/hooks/useFavorites";
import { useAuth } from "@/context/AuthContext";
import { haptics } from "@/utils/haptics";
import { spotService } from "@/services/spotService";
import { bookingService } from "@/services/bookingService";
import { formatDistance, formatTime, formatDate } from "@/utils/format";
import { openDirections } from "@/utils/directions";
import { useToast } from "@/components/ui/Toast";
import type { ParkingSpot, SpotReview } from "@/models/types";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { RatingStars } from "@/components/ui/RatingStars";
import { PriceTag } from "@/components/ui/PriceTag";
import { MapPreview, type MapPin } from "@/components/ui/MapPreview";
import { LiveMap } from "@/components/ui/LiveMap";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SpotGraphic } from "@/components/ui/SpotGraphic";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

const { width: SCREEN_W } = Dimensions.get("window");
const HERO_H = 300;

const TYPE_LABEL: Record<ParkingSpot["type"], string> = {
  home: "Home",
  driveway: "Driveway",
  garage: "Garage",
  openlot: "Open Lot",
  basement: "Basement",
};

const VEHICLE_META: Record<
  "car" | "bike" | "bicycle" | "suv",
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  car: { label: "Car", icon: "car-sport-outline" },
  bike: { label: "Bike", icon: "bicycle-outline" },
  bicycle: { label: "Bicycle", icon: "bicycle-outline" },
  suv: { label: "SUV", icon: "car-outline" },
};

/** Best-effort mapping of amenity label -> icon. */
function amenityIcon(name: string): keyof typeof Ionicons.glyphMap {
  const n = name.toLowerCase();
  if (n.includes("cctv") || n.includes("camera")) return "videocam-outline";
  if (n.includes("cover")) return "umbrella-outline";
  if (n.includes("ev") || n.includes("charg")) return "flash-outline";
  if (n.includes("guard") || n.includes("secur")) return "shield-checkmark-outline";
  if (n.includes("gate")) return "lock-closed-outline";
  if (n.includes("lit") || n.includes("light")) return "bulb-outline";
  if (n.includes("wash")) return "water-outline";
  if (n.includes("24") || n.includes("access")) return "time-outline";
  if (n.includes("valet")) return "person-outline";
  if (n.includes("wheel") || n.includes("accessible")) return "accessibility-outline";
  return "checkmark-circle-outline";
}

export default function SpotDetail() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, spacing, typography, radius, shadows } = useTheme();
  const { isFavorite, toggle } = useFavorites();
  const { user } = useAuth();
  const toast = useToast();

  const spotId: string = (route.params as any)?.id ?? "";
  const [imageIndex, setImageIndex] = useState(0);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const carouselRef = useRef<FlatList<string>>(null);

  const spotAsync = useAsync<ParkingSpot | null>(
    () => spotService.getById(spotId),
    [spotId]
  );
  const spot = spotAsync.data;

  const reviewsAsync = useAsync<SpotReview[]>(
    () => spotService.getReviews(spotId),
    [spotId]
  );

  // Count a view once per spot — but not when the host opens their own listing.
  const viewedRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      spot &&
      spot.id &&
      viewedRef.current !== spot.id &&
      spot.hostId !== user?.id
    ) {
      viewedRef.current = spot.id;
      spotService.recordView(spot.id);
    }
  }, [spot, user?.id]);

  const fav = spot ? isFavorite(spot.id) : false;

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
      setImageIndex(idx);
    },
    []
  );

  const allReviews = reviewsAsync.data ?? [];
  const reviews = useMemo(
    () => (showAllReviews ? allReviews : allReviews.slice(0, 3)),
    [showAllReviews, allReviews]
  );

  const pins = useMemo<MapPin[]>(() => [{ x: 0.5, y: 0.46, primary: true }], []);

  const getDirections = async () => {
    haptics.light();
    const opened = await openDirections(spot!.latitude, spot!.longitude);
    if (!opened) {
      toast.show("Couldn't open Google Maps on this device.", "error");
    }
  };

  // The host viewing their own listing manages it in My Space — no requesting.
  const isOwnSpot = !!spot && !!user?.id && spot.hostId === user.id;

  // One-tap parking request — host's number appears in Bookings on accept.
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);
  const sendRequest = async () => {
    if (!spot || requested || isOwnSpot) return;
    setRequesting(true);
    try {
      await bookingService.create({ spotId: spot.id });
      haptics.success();
      setRequested(true);
      toast.show(
        "Request sent! You'll see the host's number in Bookings once they accept.",
        "success"
      );
      navigation.navigate("Bookings");
    } catch (e: any) {
      haptics.error();
      toast.show(e?.message ?? "Couldn't send the request.", "error");
    } finally {
      setRequesting(false);
    }
  };

  // ── Loading ──
  if (spotAsync.loading) {
    return (
      <SafeAreaView edges={["top"]} style={[styles.flex, { backgroundColor: colors.bg }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Skeleton height={HERO_H} radius={0} />
          <View style={{ padding: spacing.xl }}>
            <Skeleton width="80%" height={24} />
            <View style={{ height: spacing.md }} />
            <Skeleton width="50%" height={16} />
            <View style={{ height: spacing.xl }} />
            <Skeleton height={90} radius={radius.lg} />
            <View style={{ height: spacing.lg }} />
            <Skeleton height={140} radius={radius.lg} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Error / not found ──
  if (spotAsync.error || !spot) {
    return (
      <SafeAreaView edges={["top"]} style={[styles.flex, styles.center, { backgroundColor: colors.bg }]}>
        <ErrorState
          title={spotAsync.error ? "Couldn't load spot" : "Spot not found"}
          subtitle={
            spotAsync.error
              ? "Please check your connection and try again."
              : "This parking spot is no longer available."
          }
          onRetry={spotAsync.error ? spotAsync.refetch : () => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  const images = spot.images.length > 0 ? spot.images : [""];
  const capacity = spot.capacity ?? 1;
  const remaining = spot.remainingCount ?? capacity;

  // Availability window (server already folds the dates into spot.available;
  // here we build the human labels and, when closed, say why).
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const nowD = new Date();
  const todayYmd = `${nowD.getFullYear()}-${pad2(nowD.getMonth() + 1)}-${pad2(nowD.getDate())}`;
  const windowText =
    spot.availableAlways || !spot.availableStartDate || !spot.availableEndDate
      ? "Every day"
      : `${formatDate(spot.availableStartDate)} – ${formatDate(spot.availableEndDate)}`;
  let closedReason: string | null = null;
  if (!spot.available) {
    // Prefer the server-computed state (timezone-correct); fall back to the
    // device clock in demo mode where the server doesn't send a state.
    const state = spot.availabilityState;
    const upcoming =
      state === "upcoming" ||
      (!state &&
        !spot.availableAlways &&
        !!spot.availableStartDate &&
        todayYmd < spot.availableStartDate);
    const ended =
      state === "ended" ||
      (!state &&
        !spot.availableAlways &&
        !!spot.availableEndDate &&
        todayYmd > spot.availableEndDate);
    if (upcoming && spot.availableStartDate) {
      closedReason = `Opens ${formatDate(spot.availableStartDate)}`;
    } else if (ended) {
      closedReason = "This listing period has ended";
    } else {
      closedReason = "Not available right now";
    }
  }
  const canRequest = spot.available && remaining > 0;

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {/* ── Image carousel ── */}
        <View style={{ height: HERO_H, backgroundColor: colors.surfaceAlt }}>
          <FlatList
            ref={carouselRef}
            data={images}
            keyExtractor={(_, i) => `img-${i}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            renderItem={({ item }) =>
              item ? (
                <Image
                  source={{ uri: item }}
                  style={{ width: SCREEN_W, height: HERO_H }}
                  resizeMode="cover"
                />
              ) : (
                <SpotGraphic
                  vehicleTypes={spot.vehicleTypes}
                  iconSize={48}
                  style={{ width: SCREEN_W, height: HERO_H }}
                />
              )
            }
          />

          {/* pagination dots */}
          {images.length > 1 ? (
            <View style={styles.dotsRow} pointerEvents="none">
              {images.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: i === imageIndex ? colors.white : "rgba(255,255,255,0.5)",
                      width: i === imageIndex ? 20 : 7,
                    },
                  ]}
                />
              ))}
            </View>
          ) : null}

          {/* image counter — only when there are real photos */}
          {spot.images.length > 0 ? (
            <View style={[styles.counter, { backgroundColor: colors.overlay, borderRadius: radius.pill }]}>
              <Ionicons name="images-outline" size={13} color={colors.white} />
              <Text style={[styles.counterText, { color: colors.white, fontFamily: typography.fonts.bodySemi }]}>
                {imageIndex + 1}/{images.length}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Body ── */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <View style={styles.typeRow}>
                <Badge label={TYPE_LABEL[spot.type]} tone="primary" size="sm" />
                {isOwnSpot ? (
                  <View style={{ marginLeft: 6 }}>
                    <Badge label="Your listing" tone="warning" size="sm" />
                  </View>
                ) : null}
                {closedReason ? (
                  <View style={{ marginLeft: 6 }}>
                    <Badge label="Unavailable" tone="error" size="sm" />
                  </View>
                ) : remaining <= 0 ? (
                  <View style={{ marginLeft: 6 }}>
                    <Badge label="Full today" tone="error" size="sm" />
                  </View>
                ) : (
                  <View style={{ marginLeft: 6 }}>
                    <Badge label="Available" tone="success" size="sm" />
                  </View>
                )}
              </View>
              <Text
                style={{
                  marginTop: spacing.sm,
                  color: colors.text,
                  fontFamily: typography.fonts.headingBold,
                  fontSize: typography.sizes.xxl,
                  lineHeight: 30,
                }}
              >
                {spot.title}
              </Text>
            </View>
          </View>

          {/* area + distance */}
          <View style={[styles.metaRow, { marginTop: spacing.sm }]}>
            <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
            <Text
              style={{
                flex: 1,
                marginLeft: 6,
                color: colors.textSecondary,
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.md,
              }}
            >
              {[spot.area, spot.city].filter(Boolean).join(", ")}
              {spot.nearStation
                ? ` · ${formatDistance(spot.distanceMeters)} from ${spot.nearStation}`
                : ""}
            </Text>
          </View>

          <View style={{ marginTop: spacing.sm }}>
            {spot.reviewsCount > 0 ? (
              <RatingStars value={spot.rating} size={16} count={spot.reviewsCount} />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="sparkles-outline" size={14} color={colors.textMuted} />
                <Text
                  style={{
                    marginLeft: 5,
                    color: colors.textMuted,
                    fontFamily: typography.fonts.bodyMedium,
                    fontSize: typography.sizes.sm,
                  }}
                >
                  New — no ratings yet
                </Text>
              </View>
            )}
          </View>

          {/* vehicle types */}
          <View style={[styles.vehicleRow, { marginTop: spacing.md }]}>
            {spot.vehicleTypes.map((v) => {
              const meta = VEHICLE_META[v];
              return (
                <View
                  key={v}
                  style={[
                    styles.vehiclePill,
                    { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill },
                  ]}
                >
                  <Ionicons name={meta.icon} size={15} color={colors.primary} />
                  <Text
                    style={{
                      marginLeft: 5,
                      color: colors.text,
                      fontFamily: typography.fonts.bodyMedium,
                      fontSize: typography.sizes.sm,
                    }}
                  >
                    {meta.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* ── Host card ── */}
          <View style={{ marginTop: spacing.xl }}>
            <Card padded>
              <View style={styles.hostRow}>
                <Avatar uri={spot.host.avatar} name={spot.host.name} size={52} />
                <View style={[styles.flex, { marginLeft: spacing.md }]}>
                  <View style={styles.hostNameRow}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: colors.text,
                        fontFamily: typography.fonts.bodySemi,
                        fontSize: typography.sizes.md,
                      }}
                    >
                      {spot.host.name}
                    </Text>
                    {spot.host.verified ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={colors.primary}
                        style={{ marginLeft: 5 }}
                      />
                    ) : null}
                  </View>
                  <Text
                    style={{
                      marginTop: 2,
                      color: colors.textSecondary,
                      fontFamily: typography.fonts.body,
                      fontSize: typography.sizes.sm,
                    }}
                  >
                    Hosts responds {spot.host.responseTime}
                  </Text>
                </View>
                <View style={styles.hostRating}>
                  <Ionicons
                    name="star"
                    size={14}
                    color={spot.host.reviewsCount > 0 ? colors.star : colors.textMuted}
                  />
                  <Text
                    style={{
                      marginLeft: 4,
                      color: spot.host.reviewsCount > 0 ? colors.text : colors.textMuted,
                      fontFamily: typography.fonts.bodySemi,
                      fontSize: typography.sizes.sm,
                    }}
                  >
                    {spot.host.reviewsCount > 0 ? spot.host.rating.toFixed(1) : "New"}
                  </Text>
                </View>
              </View>
            </Card>
          </View>

          {/* ── Amenities ── */}
          {spot.amenities.length > 0 ? (
            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title="Amenities" />
              <View style={styles.amenityWrap}>
                {spot.amenities.map((a) => (
                  <Chip
                    key={a}
                    label={a}
                    icon={<Ionicons name={amenityIcon(a)} size={15} color={colors.primary} />}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* ── Availability ── */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="Availability" />
            <Card padded elevated={false}>
              <View style={styles.availRow}>
                <View style={[styles.availIcon, { backgroundColor: colors.primaryLight, borderRadius: radius.md }]}>
                  <Ionicons name="time-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: typography.fonts.body,
                      fontSize: typography.sizes.xs,
                    }}
                  >
                    Open hours
                  </Text>
                  <Text
                    style={{
                      marginTop: 2,
                      color: colors.text,
                      fontFamily: typography.fonts.bodySemi,
                      fontSize: typography.sizes.md,
                    }}
                  >
                    {formatTime(spot.availableFrom)} – {formatTime(spot.availableTo)}
                  </Text>
                </View>
              </View>
              <View style={[styles.availRow, { marginTop: spacing.md }]}>
                <View
                  style={[
                    styles.availIcon,
                    {
                      backgroundColor: remaining > 0 ? colors.primaryLight : colors.surfaceAlt,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <Ionicons
                    name="car-outline"
                    size={20}
                    color={remaining > 0 ? colors.primary : colors.textMuted}
                  />
                </View>
                <View style={styles.flex}>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: typography.fonts.body,
                      fontSize: typography.sizes.xs,
                    }}
                  >
                    Spots available
                  </Text>
                  <Text
                    style={{
                      marginTop: 2,
                      color: remaining > 0 ? colors.success : colors.error,
                      fontFamily: typography.fonts.bodySemi,
                      fontSize: typography.sizes.md,
                    }}
                  >
                    {remaining > 0
                      ? `${remaining} of ${capacity} ${capacity === 1 ? "spot" : "spots"} available`
                      : "Currently full"}
                  </Text>
                </View>
              </View>

              {/* Availability window (dates the host opened the space for) */}
              <View style={[styles.availRow, { marginTop: spacing.md }]}>
                <View style={[styles.availIcon, { backgroundColor: colors.primaryLight, borderRadius: radius.md }]}>
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: typography.fonts.body,
                      fontSize: typography.sizes.xs,
                    }}
                  >
                    Available dates
                  </Text>
                  <Text
                    style={{
                      marginTop: 2,
                      color: colors.text,
                      fontFamily: typography.fonts.bodySemi,
                      fontSize: typography.sizes.md,
                    }}
                  >
                    {windowText}
                  </Text>
                  {closedReason ? (
                    <Text
                      style={{
                        marginTop: 2,
                        color: colors.error,
                        fontFamily: typography.fonts.bodyMedium,
                        fontSize: typography.sizes.xs,
                      }}
                    >
                      {closedReason}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Card>
          </View>

          {/* ── Instructions ── */}
          {spot.instructions ? (
            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title="Parking instructions" />
              <Card padded elevated={false}>
                <View style={styles.instructionRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color={colors.info}
                    style={{ marginTop: 1 }}
                  />
                  <Text
                    style={{
                      flex: 1,
                      marginLeft: spacing.sm,
                      color: colors.textSecondary,
                      fontFamily: typography.fonts.body,
                      fontSize: typography.sizes.md,
                      lineHeight: 22,
                    }}
                  >
                    {spot.instructions}
                  </Text>
                </View>
              </Card>
            </View>
          ) : null}

          {/* ── Location / map ── */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="Location" />
            <LiveMap
              markers={[{ latitude: spot.latitude, longitude: spot.longitude, title: spot.title, primary: true }]}
              height={170}
            />
            <View style={[styles.metaRow, { marginTop: spacing.sm }]}>
              <Ionicons name="navigate-circle-outline" size={16} color={colors.textSecondary} />
              <Text
                style={{
                  flex: 1,
                  marginLeft: 6,
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.body,
                  fontSize: typography.sizes.sm,
                }}
              >
                {spot.address} · {spot.landmark}
              </Text>
            </View>
            <Button
              label="Get directions"
              variant="secondary"
              onPress={getDirections}
              iconLeft={<Ionicons name="navigate" size={16} color={colors.white} />}
              style={{ marginTop: spacing.md }}
              fullWidth
            />
          </View>

          {/* ── Reviews (hidden until the spot actually has some) ── */}
          {reviews.length > 0 ? (
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title={`Reviews (${spot.reviewsCount})`} />
            {reviews.map((r, index) => (
              <MotiView
                key={r.id}
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "timing", duration: 300, delay: index * 40 }}
                style={[
                  styles.reviewCard,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: radius.lg,
                    borderColor: colors.border,
                    padding: spacing.md,
                    marginBottom: spacing.md,
                    ...shadows.sm,
                  },
                ]}
              >
                <View style={styles.reviewHead}>
                  <Avatar uri={r.raterAvatar ?? undefined} name={r.raterName} size={40} />
                  <View style={[styles.flex, { marginLeft: spacing.sm }]}>
                    <Text
                      style={{
                        color: colors.text,
                        fontFamily: typography.fonts.bodySemi,
                        fontSize: typography.sizes.sm,
                      }}
                    >
                      {r.raterName}
                    </Text>
                    <View style={{ marginTop: 2 }}>
                      <RatingStars value={r.stars} size={12} />
                    </View>
                  </View>
                </View>
                {r.comment ? (
                  <Text
                    style={{
                      marginTop: spacing.sm,
                      color: colors.textSecondary,
                      fontFamily: typography.fonts.body,
                      fontSize: typography.sizes.sm,
                      lineHeight: 20,
                    }}
                  >
                    {r.comment}
                  </Text>
                ) : null}
              </MotiView>
            ))}

            {!showAllReviews && allReviews.length > 3 ? (
              <Pressable
                onPress={() => {
                  haptics.light();
                  setShowAllReviews(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Show all reviews"
                style={({ pressed }) => [
                  styles.showAll,
                  {
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: typography.fonts.bodySemi,
                    fontSize: typography.sizes.sm,
                  }}
                >
                  Show all {allReviews.length} reviews
                </Text>
              </Pressable>
            ) : null}
          </View>
          ) : null}
        </View>
      </ScrollView>

      {/* ── Floating top bar (back + favorite) ── */}
      <SafeAreaView edges={["top"]} style={styles.floatingBar} pointerEvents="box-none">
        <View style={[styles.floatingRow, { paddingHorizontal: spacing.xl }]}>
          <Pressable
            onPress={() => {
              haptics.light();
              navigation.goBack();
            }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={[styles.circleBtn, { backgroundColor: colors.surface, ...shadows.md }]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>

          <Pressable
            onPress={() => {
              haptics.light();
              toggle(spot.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={fav ? "Remove from favorites" : "Add to favorites"}
            style={[styles.circleBtn, { backgroundColor: colors.surface, ...shadows.md }]}
          >
            <Ionicons
              name={fav ? "heart" : "heart-outline"}
              size={22}
              color={fav ? colors.error : colors.text}
            />
          </Pressable>
        </View>
      </SafeAreaView>

      {/* ── Sticky bottom bar ── */}
      <SafeAreaView edges={["bottom"]} style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={[styles.bottomInner, { paddingHorizontal: spacing.xl }]}>
          <View>
            <Text
              style={{
                color: colors.textMuted,
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.xs,
              }}
            >
              From
            </Text>
            <PriceTag amount={spot.pricePerDay} period="day" free={spot.isFree} />
          </View>

          <View style={{ flex: 1, marginLeft: spacing.lg }}>
            {isOwnSpot ? (
              <Button
                label="Manage listing"
                variant="secondary"
                size="lg"
                fullWidth
                iconLeft={<Ionicons name="home" size={17} color={colors.white} />}
                onPress={() => {
                  haptics.light();
                  navigation.navigate("Main", { screen: "Post" });
                }}
              />
            ) : (
              <Button
                label={
                  requested
                    ? "Requested ✓"
                    : closedReason
                    ? "Unavailable"
                    : remaining <= 0
                    ? "Currently full"
                    : "Request to park"
                }
                variant="gradient"
                size="lg"
                fullWidth
                loading={requesting}
                disabled={!canRequest || requested}
                iconRight={
                  requested ? undefined : (
                    <Ionicons name="paper-plane" size={17} color={colors.white} />
                  )
                }
                onPress={sendRequest}
              />
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  dotsRow: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  counter: {
    position: "absolute",
    bottom: 14,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  counterText: {
    fontSize: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  vehicleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  vehiclePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  hostNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  hostRating: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  amenityWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  availRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  availIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  instructionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  reviewCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  reviewHead: {
    flexDirection: "row",
    alignItems: "center",
  },
  showAll: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderWidth: 1.5,
  },
  floatingBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  floatingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
  },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bottomInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 4,
  },
});
