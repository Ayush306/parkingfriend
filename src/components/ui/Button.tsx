import React from "react";
import {
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeContext";
import { haptics } from "@/utils/haptics";

type Variant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "gradient";
type Size = "sm" | "md" | "lg";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  fullWidth,
  style,
}: ButtonProps) {
  const { colors, radius, typography, gradients } = useTheme();
  const scale = useSharedValue(1);

  const isDisabled = disabled || loading;

  const sizeConfig = {
    sm: { paddingV: 9, paddingH: 14, font: typography.sizes.sm, minH: 38 },
    md: { paddingV: 13, paddingH: 18, font: typography.sizes.md, minH: 50 },
    lg: { paddingV: 16, paddingH: 22, font: typography.sizes.lg, minH: 58 },
  }[size];

  const bgFor: Record<Variant, string> = {
    primary: colors.primary,
    secondary: colors.secondary,
    outline: "transparent",
    ghost: "transparent",
    danger: colors.error,
    gradient: "transparent",
  };

  const textColorFor: Record<Variant, string> = {
    primary: colors.white,
    secondary: colors.white,
    outline: colors.primary,
    ghost: colors.primary,
    danger: colors.white,
    gradient: colors.white,
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, { duration: 90 });
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 120 });
  };
  const handlePress = () => {
    if (isDisabled) return;
    haptics.light();
    onPress?.();
  };

  const containerStyle: StyleProp<ViewStyle> = [
    styles.base,
    {
      minHeight: sizeConfig.minH,
      paddingVertical: sizeConfig.paddingV,
      paddingHorizontal: sizeConfig.paddingH,
      borderRadius: radius.md,
      backgroundColor: bgFor[variant],
      borderWidth: variant === "outline" ? 1.5 : 0,
      borderColor: variant === "outline" ? colors.primary : "transparent",
      width: fullWidth ? "100%" : undefined,
      opacity: isDisabled ? 0.55 : 1,
    },
    style,
  ];

  const textStyle: TextStyle = {
    fontFamily: typography.fonts.bodySemi,
    fontSize: sizeConfig.font,
    color: textColorFor[variant],
    letterSpacing: 0.2,
  };

  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator size="small" color={textColorFor[variant]} />
      ) : (
        <>
          {iconLeft ? <View style={styles.iconLeft}>{iconLeft}</View> : null}
          <Text style={textStyle} numberOfLines={1}>
            {label}
          </Text>
          {iconRight ? (
            <View style={styles.iconRight}>{iconRight}</View>
          ) : null}
        </>
      )}
    </View>
  );

  if (variant === "gradient") {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        style={[
          animatedStyle,
          { width: fullWidth ? "100%" : undefined, opacity: isDisabled ? 0.55 : 1 },
        ]}
      >
        <LinearGradient
          colors={gradients.primary as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.base,
            {
              minHeight: sizeConfig.minH,
              paddingVertical: sizeConfig.paddingV,
              paddingHorizontal: sizeConfig.paddingH,
              borderRadius: radius.md,
            },
            style,
          ]}
        >
          {content}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[containerStyle, animatedStyle]}
    >
      {content}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
