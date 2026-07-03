import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/ThemeContext";
import { haptics } from "@/utils/haptics";

export interface ListItemProps {
  title: string;
  subtitle?: string;
  leftIcon?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}

export function ListItem({
  title,
  subtitle,
  leftIcon,
  right,
  onPress,
  danger,
}: ListItemProps) {
  const { colors, radius, spacing, typography } = useTheme();

  const titleColor = danger ? colors.error : colors.text;

  const content = (
    <>
      {leftIcon ? (
        <View
          style={[
            styles.leftIconWrap,
            {
              backgroundColor: danger
                ? "rgba(239,68,68,0.10)"
                : colors.surfaceAlt,
              borderRadius: radius.md,
              marginRight: spacing.md,
            },
          ]}
        >
          {leftIcon}
        </View>
      ) : null}

      <View style={styles.textWrap}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: typography.fonts.bodySemi,
            fontSize: typography.sizes.md,
            color: titleColor,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: typography.fonts.body,
              fontSize: typography.sizes.sm,
              color: colors.textSecondary,
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.rightWrap}>
        {right !== undefined ? (
          right
        ) : onPress ? (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textMuted}
          />
        ) : null}
      </View>
    </>
  );

  const rowStyle = {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  };

  if (!onPress) {
    return <View style={[styles.row, rowStyle]}>{content}</View>;
  }

  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.row,
        rowStyle,
        { backgroundColor: pressed ? colors.surfaceAlt : "transparent" },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  leftIconWrap: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
  },
  rightWrap: {
    marginLeft: 12,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
