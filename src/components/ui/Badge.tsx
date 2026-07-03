import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { useTheme } from "@/theme/ThemeContext";

type Tone = "primary" | "success" | "warning" | "error" | "neutral";
type BadgeSize = "sm" | "md";

export interface BadgeProps {
  label: string;
  tone?: Tone;
  size?: BadgeSize;
}

export function Badge({ label, tone = "primary", size = "md" }: BadgeProps) {
  const { colors, radius, typography, spacing, isDark } = useTheme();

  const toneMap: Record<Tone, { fg: string; bg: string }> = {
    primary: {
      fg: colors.primary,
      bg: isDark ? colors.primaryLight : colors.primaryLight,
    },
    success: {
      fg: colors.success,
      bg: isDark ? "rgba(34,197,94,0.16)" : "rgba(22,163,74,0.12)",
    },
    warning: {
      fg: colors.warning,
      bg: isDark ? "rgba(251,191,36,0.16)" : "rgba(245,158,11,0.14)",
    },
    error: {
      fg: colors.error,
      bg: isDark ? "rgba(248,113,113,0.16)" : "rgba(239,68,68,0.12)",
    },
    neutral: {
      fg: colors.textSecondary,
      bg: colors.surfaceAlt,
    },
  };

  const { fg, bg } = toneMap[tone];
  const isSm = size === "sm";

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: bg,
          borderRadius: radius.pill,
          paddingHorizontal: isSm ? spacing.sm : spacing.md,
          paddingVertical: isSm ? 2 : 4,
        },
      ]}
    >
      <Text
        style={{
          color: fg,
          fontFamily: typography.fonts.bodySemi,
          fontSize: isSm ? typography.sizes.xs : typography.sizes.sm,
          letterSpacing: 0.2,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
  },
});
