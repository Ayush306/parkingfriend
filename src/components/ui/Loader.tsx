import React from "react";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { useTheme } from "@/theme/ThemeContext";

export interface LoaderProps {
  size?: "small" | "large" | number;
  label?: string;
  fullscreen?: boolean;
  color?: string;
  style?: ViewStyle | ViewStyle[];
}

export const Loader: React.FC<LoaderProps> = ({
  size = "large",
  label,
  fullscreen = false,
  color,
  style,
}) => {
  const { colors, spacing, typography } = useTheme();

  const content = (
    <View
      style={[
        styles.inner,
        fullscreen && { backgroundColor: colors.bg },
        style as ViewStyle,
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? "Loading"}
    >
      <ActivityIndicator size={size} color={color ?? colors.primary} />
      {label ? (
        <Text
          style={{
            marginTop: spacing.md,
            color: colors.textSecondary,
            fontFamily: typography.fonts.bodyMedium,
            fontSize: typography.sizes.sm,
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );

  if (fullscreen) {
    return <View style={styles.fullscreen}>{content}</View>;
  }
  return content;
};

const styles = StyleSheet.create({
  fullscreen: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  inner: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
});
