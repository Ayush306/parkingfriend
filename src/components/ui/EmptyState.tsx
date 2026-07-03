import React from "react";
import { View, Text, StyleSheet, Pressable, ViewStyle } from "react-native";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/theme/ThemeContext";
import { EmptyBox } from "@/components/illustrations/EmptyBox";
import type { IllustrationProps } from "@/components/illustrations/EmptyBox";

export interface EmptyStateProps {
  illustration?: React.ComponentType<IllustrationProps>;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle | ViewStyle[];
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  illustration: Illustration = EmptyBox,
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
}) => {
  const { colors, spacing, typography, radius } = useTheme();

  const handleAction = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onAction?.();
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 380 }}
      style={[styles.container, { padding: spacing.xxl }, style as ViewStyle]}
      accessibilityLabel={title}
    >
      <Illustration size={160} color={colors.primary} />
      <Text
        style={{
          marginTop: spacing.lg,
          color: colors.text,
          fontFamily: typography.fonts.heading,
          fontSize: typography.sizes.xl,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            marginTop: spacing.sm,
            color: colors.textSecondary,
            fontFamily: typography.fonts.body,
            fontSize: typography.sizes.md,
            textAlign: "center",
            lineHeight: 22,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={handleAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.pill,
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.md,
              marginTop: spacing.xl,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
        >
          <Text
            style={{
              color: colors.white,
              fontFamily: typography.fonts.bodySemi,
              fontSize: typography.sizes.md,
            }}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </MotiView>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  action: {
    alignItems: "center",
    justifyContent: "center",
  },
});
