import React from "react";
import { StyleSheet, ViewStyle, StyleProp } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/theme/ThemeContext";

export interface GradientBackgroundProps {
  colors?: string[];
  style?: StyleProp<ViewStyle>;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  children?: React.ReactNode;
}

export const GradientBackground: React.FC<GradientBackgroundProps> = ({
  colors,
  style,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  children,
}) => {
  const { gradients } = useTheme();
  const resolved = (colors && colors.length >= 2
    ? colors
    : gradients.primary) as [string, string, ...string[]];

  return (
    <LinearGradient
      colors={resolved}
      start={start}
      end={end}
      style={[styles.fill, style]}
    >
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
