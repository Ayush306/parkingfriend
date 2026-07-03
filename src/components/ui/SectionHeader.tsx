import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useTheme } from "@/theme/ThemeContext";
import { haptics } from "@/utils/haptics";

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: SectionHeaderProps) {
  const { colors, typography, spacing } = useTheme();

  return (
    <View style={[styles.row, { marginBottom: spacing.md }]}>
      <Text
        style={{
          fontFamily: typography.fonts.heading,
          fontSize: typography.sizes.lg,
          color: colors.text,
        }}
      >
        {title}
      </Text>

      {actionLabel && onAction ? (
        <Pressable
          onPress={() => {
            haptics.light();
            onAction();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text
            style={{
              fontFamily: typography.fonts.bodySemi,
              fontSize: typography.sizes.sm,
              color: colors.primary,
            }}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
