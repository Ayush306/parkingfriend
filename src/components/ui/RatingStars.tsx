import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/ThemeContext";

export interface RatingStarsProps {
  value: number;
  size?: number;
  count?: number;
}

export function RatingStars({ value, size = 14, count }: RatingStarsProps) {
  const { colors, typography, spacing } = useTheme();
  const clamped = Math.max(0, Math.min(5, value));

  const stars = [1, 2, 3, 4, 5].map((i) => {
    if (clamped >= i) return "star";
    if (clamped >= i - 0.5) return "star-half";
    return "star-outline";
  });

  return (
    <View style={styles.row} accessibilityLabel={`Rated ${clamped} out of 5`}>
      <View style={styles.stars}>
        {stars.map((icon, idx) => (
          <Ionicons
            key={idx}
            name={icon as any}
            size={size}
            color={colors.star}
            style={{ marginRight: 1 }}
          />
        ))}
      </View>
      <Text
        style={{
          fontFamily: typography.fonts.bodySemi,
          fontSize: size,
          color: colors.text,
          marginLeft: spacing.xs + 2,
        }}
      >
        {clamped.toFixed(1)}
      </Text>
      {typeof count === "number" ? (
        <Text
          style={{
            fontFamily: typography.fonts.body,
            fontSize: size - 1,
            color: colors.textMuted,
            marginLeft: 4,
          }}
        >
          ({count})
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  stars: {
    flexDirection: "row",
    alignItems: "center",
  },
});
