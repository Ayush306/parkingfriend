import React from "react";
import { Pressable, StyleSheet, StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeContext";
import { haptics } from "@/utils/haptics";

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Card({
  children,
  onPress,
  style,
  padded = true,
  elevated = true,
}: CardProps) {
  const { colors, radius, spacing, shadows } = useTheme();
  const scale = useSharedValue(1);

  const baseStyle: StyleProp<ViewStyle> = [
    styles.base,
    elevated ? shadows.md : undefined,
    {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: padded ? spacing.lg : 0,
      borderWidth: elevated ? 0 : StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    style,
  ];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!onPress) {
    return <Animated.View style={baseStyle}>{children}</Animated.View>;
  }

  return (
    <AnimatedPressable
      onPress={() => {
        haptics.light();
        onPress();
      }}
      onPressIn={() => (scale.value = withTiming(0.98, { duration: 90 }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: 130 }))}
      accessibilityRole="button"
      style={[baseStyle, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
  },
});
