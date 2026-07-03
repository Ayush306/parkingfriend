import React, { useState } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useTheme } from "@/theme/ThemeContext";

export interface AvatarProps {
  uri?: string;
  name?: string;
  size?: number;
}

function initialsFrom(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function Avatar({ uri, name, size = 44 }: AvatarProps) {
  const { colors, typography, radius } = useTheme();
  const [failed, setFailed] = useState(false);

  const showImage = uri && !failed;

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: radius.pill,
          backgroundColor: colors.primaryLight,
          borderColor: colors.border,
        },
      ]}
      accessibilityLabel={name ? `${name} avatar` : "avatar"}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={{
            width: size,
            height: size,
            borderRadius: radius.pill,
            backgroundColor: colors.surfaceAlt,
          }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text
          style={{
            fontFamily: typography.fonts.bodySemi,
            fontSize: size * 0.38,
            color: colors.primary,
          }}
        >
          {initialsFrom(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
