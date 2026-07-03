import React from "react";
import { Text, StyleSheet, Pressable, ViewStyle } from "react-native";
import { MotiView } from "moti";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/theme/ThemeContext";

export interface FABProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label?: string;
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
}

export const FAB: React.FC<FABProps> = ({
  icon,
  onPress,
  label,
  style,
  accessibilityLabel,
}) => {
  const { colors, spacing, typography, radius, shadows, gradients } =
    useTheme();
  const [pressed, setPressed] = React.useState(false);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label ?? "Action"}
      style={[styles.wrap, style as ViewStyle]}
    >
      <MotiView
        animate={{ scale: pressed ? 0.94 : 1 }}
        transition={{ type: "timing", duration: 120 }}
        style={[styles.shadow, { borderRadius: radius.pill, ...shadows.lg }]}
      >
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.inner,
            label
              ? {
                  paddingHorizontal: spacing.lg,
                  height: 56,
                  borderRadius: radius.pill,
                }
              : {
                  width: 56,
                  height: 56,
                  borderRadius: radius.pill,
                },
          ]}
        >
          <Ionicons name={icon} size={24} color={colors.white} />
          {label ? (
            <Text
              style={{
                marginLeft: spacing.sm,
                color: colors.white,
                fontFamily: typography.fonts.bodySemi,
                fontSize: typography.sizes.md,
              }}
            >
              {label}
            </Text>
          ) : null}
        </LinearGradient>
      </MotiView>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 20,
    bottom: 24,
  },
  shadow: {},
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
