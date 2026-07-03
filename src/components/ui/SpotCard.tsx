import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeContext";
import { haptics } from "@/utils/haptics";
import { formatDistance } from "@/utils/format";
import type { ParkingSpot } from "@/models/types";
import { PriceTag } from "@/components/ui/PriceTag";
import { RatingStars } from "@/components/ui/RatingStars";
import { Badge } from "@/components/ui/Badge";

export type SpotCardVariant = "featured" | "list";

export interface SpotCardProps {
  spot: ParkingSpot;
  onPress?: () => void;
  /** "featured" = fixed-width horizontal carousel card; "list" = full-width row card. */
  variant?: SpotCardVariant;
  /** Whether this spot is currently favorited (drives the heart icon). */
  favorite?: boolean;
  /** Toggle handler for the heart button. Omit to hide the heart. */
  onToggleFavorite?: () => void;
  /** Fixed width for the featured variant. */
  width?: number;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const TYPE_LABEL: Record<ParkingSpot["type"], string> = {
  driveway: "Driveway",
  garage: "Garage",
  openlot: "Open Lot",
  basement: "Basement",
};

const TYPE_ICON: Record<ParkingSpot["type"], keyof typeof Ionicons.glyphMap> = {
  driveway: "home-outline",
  garage: "business-outline",
  openlot: "map-outline",
  basement: "layers-outline",
};

export function SpotCard({
  spot,
  onPress,
  variant = "list",
  favorite,
  onToggleFavorite,
  width,
  style,
}: SpotCardProps) {
  const { colors, radius, spacing, typography, shadows } = useTheme();
  const scale = useSharedValue(1);
  const isFeatured = variant === "featured";

  const cardWidth = isFeatured ? width ?? 260 : undefined;
  const imageHeight = isFeatured ? 132 : 116;
  const cover = spot.images?.[0];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleHeart = () => {
    if (!onToggleFavorite) return;
    haptics.light();
    onToggleFavorite();
  };

  return (
    <AnimatedPressable
      onPress={() => {
        if (!onPress) return;
        haptics.light();
        onPress();
      }}
      onPressIn={() => (scale.value = withTiming(0.98, { duration: 90 }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: 130 }))}
      accessibilityRole="button"
      accessibilityLabel={`${spot.title}, ${formatDistance(spot.distanceMeters)} away`}
      style={[
        styles.base,
        shadows.md,
        {
          width: cardWidth,
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
        },
        animatedStyle,
        style,
      ]}
    >
      {/* Cover image */}
      <View
        style={[
          styles.imageWrap,
          { height: imageHeight, backgroundColor: colors.surfaceAlt },
        ]}
      >
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons name="car-outline" size={30} color={colors.textMuted} />
          </View>
        )}

        {/* distance chip */}
        <View
          style={[
            styles.distancePill,
            {
              backgroundColor: colors.overlay,
              borderRadius: radius.pill,
              paddingHorizontal: spacing.sm + 2,
              paddingVertical: 4,
            },
          ]}
        >
          <Ionicons name="navigate" size={11} color={colors.white} />
          <Text
            style={{
              marginLeft: 4,
              color: colors.white,
              fontFamily: typography.fonts.bodySemi,
              fontSize: typography.sizes.xs,
            }}
          >
            {formatDistance(spot.distanceMeters)}
          </Text>
        </View>

        {/* favorite heart */}
        {onToggleFavorite ? (
          <Pressable
            onPress={handleHeart}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={favorite ? "Remove from favorites" : "Add to favorites"}
            style={[
              styles.heart,
              { backgroundColor: colors.surface, borderRadius: radius.pill },
            ]}
          >
            <Ionicons
              name={favorite ? "heart" : "heart-outline"}
              size={18}
              color={favorite ? colors.error : colors.textSecondary}
            />
          </Pressable>
        ) : null}

        {/* availability badge when unavailable */}
        {!spot.available ? (
          <View style={styles.badgeOverlay}>
            <Badge label="Full" tone="error" size="sm" />
          </View>
        ) : null}
      </View>

      {/* Body */}
      <View style={{ padding: spacing.md }}>
        <View style={styles.typeRow}>
          <Ionicons
            name={TYPE_ICON[spot.type]}
            size={13}
            color={colors.primary}
          />
          <Text
            style={{
              marginLeft: 5,
              color: colors.primary,
              fontFamily: typography.fonts.bodySemi,
              fontSize: typography.sizes.xs,
              letterSpacing: 0.2,
            }}
          >
            {TYPE_LABEL[spot.type]}
          </Text>
          <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: colors.textMuted,
              fontFamily: typography.fonts.body,
              fontSize: typography.sizes.xs,
            }}
          >
            {spot.nearStation}
          </Text>
        </View>

        <Text
          numberOfLines={isFeatured ? 1 : 2}
          style={{
            marginTop: spacing.xs + 2,
            color: colors.text,
            fontFamily: typography.fonts.heading,
            fontSize: typography.sizes.md,
            lineHeight: 20,
          }}
        >
          {spot.title}
        </Text>

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={colors.textMuted} />
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              marginLeft: 4,
              color: colors.textSecondary,
              fontFamily: typography.fonts.body,
              fontSize: typography.sizes.sm,
            }}
          >
            {spot.area}
          </Text>
        </View>

        <View
          style={[
            styles.footerRow,
            { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopColor: colors.border },
          ]}
        >
          <RatingStars value={spot.rating} size={13} count={spot.reviewsCount} />
          <PriceTag
            amount={spot.pricePerDay}
            period="day"
            free={spot.isFree}
          />
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
  },
  imageWrap: {
    width: "100%",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  distancePill: {
    position: "absolute",
    left: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  heart: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeOverlay: {
    position: "absolute",
    top: 10,
    left: 10,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
