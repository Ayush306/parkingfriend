import React from "react";
import { Pressable, StyleSheet, StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeContext";
import { haptics } from "@/utils/haptics";

type Variant = "primary" | "secondary" | "surface" | "ghost" | "danger";

export interface IconButtonProps {
  icon: React.ReactNode;
  onPress?: () => void;
  size?: number;
  variant?: Variant;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function IconButton({
  icon,
  onPress,
  size = 44,
  variant = "surface",
  accessibilityLabel,
  style,
  disabled,
}: IconButtonProps) {
  const { colors, radius, shadows } = useTheme();
  const scale = useSharedValue(1);

  const bgFor: Record<Variant, string> = {
    primary: colors.primary,
    secondary: colors.secondary,
    surface: colors.surface,
    ghost: "transparent",
    danger: colors.error,
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={() => {
        if (disabled) return;
        haptics.light();
        onPress?.();
      }}
      onPressIn={() => (scale.value = withTiming(0.9, { duration: 90 }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: 120 }))}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={[
        styles.base,
        variant === "surface" ? shadows.sm : undefined,
        {
          width: size,
          height: size,
          borderRadius: radius.pill,
          backgroundColor: bgFor[variant],
          borderWidth: variant === "surface" ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.border,
          opacity: disabled ? 0.5 : 1,
        },
        animatedStyle,
        style,
      ]}
    >
      {icon}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
});
