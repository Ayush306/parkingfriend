import React from "react";
import { Text, StyleSheet, Pressable, View } from "react-native";
import { useTheme } from "@/theme/ThemeContext";
import { haptics } from "@/utils/haptics";

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
}

export function Chip({ label, selected, onPress, icon }: ChipProps) {
  const { colors, radius, typography, spacing } = useTheme();

  const bg = selected ? colors.primary : colors.surface;
  const borderColor = selected ? colors.primary : colors.border;
  const textColor = selected ? colors.white : colors.textSecondary;

  const content = (
    <View style={styles.inner}>
      {icon ? <View style={{ marginRight: spacing.xs + 2 }}>{icon}</View> : null}
      <Text
        style={{
          fontFamily: typography.fonts.bodyMedium,
          fontSize: typography.sizes.sm,
          color: textColor,
        }}
      >
        {label}
      </Text>
    </View>
  );

  const chipStyle = {
    borderRadius: radius.pill,
    backgroundColor: bg,
    borderColor,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    borderWidth: 1.5,
  };

  if (!onPress) {
    return <View style={[styles.base, chipStyle]}>{content}</View>;
  }

  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        chipStyle,
        { opacity: pressed ? 0.75 : 1 },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
  },
});
