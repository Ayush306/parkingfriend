import React from "react";
import { View, StyleSheet, DimensionValue, ViewStyle } from "react-native";
import { MotiView } from "moti";
import { useTheme } from "@/theme/ThemeContext";

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: ViewStyle | ViewStyle[];
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = 16,
  radius,
  style,
}) => {
  const { colors, radius: themeRadius } = useTheme();
  const br = radius ?? themeRadius.sm;

  return (
    <MotiView
      from={{ opacity: 0.45 }}
      animate={{ opacity: 0.9 }}
      transition={{
        type: "timing",
        duration: 850,
        loop: true,
        repeatReverse: true,
      }}
      style={[
        {
          width,
          height,
          borderRadius: br,
          backgroundColor: colors.surfaceAlt,
        },
        style as ViewStyle,
      ]}
    />
  );
};

export interface SkeletonCardProps {
  style?: ViewStyle | ViewStyle[];
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ style }) => {
  const { colors, spacing, radius, shadows } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.md,
          ...shadows.sm,
        },
        style as ViewStyle,
      ]}
      accessibilityLabel="Loading content"
    >
      <Skeleton height={140} radius={radius.md} />
      <View style={{ height: spacing.md }} />
      <Skeleton width="70%" height={16} />
      <View style={{ height: spacing.sm }} />
      <Skeleton width="45%" height={12} />
      <View style={{ height: spacing.md }} />
      <View style={styles.row}>
        <Skeleton width={72} height={24} radius={radius.pill} />
        <Skeleton width={90} height={24} radius={radius.pill} />
      </View>
    </View>
  );
};

export interface SkeletonListProps {
  count?: number;
  card?: boolean;
  style?: ViewStyle | ViewStyle[];
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
  count = 4,
  card = true,
  style,
}) => {
  const { spacing, radius } = useTheme();

  return (
    <View style={style as ViewStyle}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ marginBottom: spacing.md }}>
          {card ? (
            <SkeletonCard />
          ) : (
            <View style={styles.row}>
              <Skeleton width={56} height={56} radius={radius.md} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Skeleton width="60%" height={15} />
                <View style={{ height: spacing.sm }} />
                <Skeleton width="40%" height={12} />
              </View>
            </View>
          )}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
