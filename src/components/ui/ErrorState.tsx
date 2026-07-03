import React from "react";
import { View, Text, StyleSheet, Pressable, ViewStyle } from "react-native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/theme/ThemeContext";

export interface ErrorStateProps {
  title?: string;
  subtitle?: string;
  onRetry?: () => void;
  style?: ViewStyle | ViewStyle[];
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  subtitle = "We couldn't load this right now. Please try again.",
  onRetry,
  style,
}) => {
  const { colors, spacing, typography, radius } = useTheme();

  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onRetry?.();
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 380 }}
      style={[styles.container, { padding: spacing.xxl }, style as ViewStyle]}
      accessibilityLabel={title}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: colors.error + "1A", borderRadius: radius.pill },
        ]}
      >
        <Ionicons name="cloud-offline-outline" size={44} color={colors.error} />
      </View>
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
      {onRetry ? (
        <Pressable
          onPress={handleRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          style={({ pressed }) => [
            styles.retry,
            {
              borderColor: colors.primary,
              borderRadius: radius.pill,
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.md,
              marginTop: spacing.xl,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
        >
          <Ionicons name="refresh" size={18} color={colors.primary} />
          <Text
            style={{
              marginLeft: spacing.sm,
              color: colors.primary,
              fontFamily: typography.fonts.bodySemi,
              fontSize: typography.sizes.md,
            }}
          >
            Try again
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
  iconWrap: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
  },
  retry: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
});
