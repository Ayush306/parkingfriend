import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { useTheme } from "@/theme/ThemeContext";

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  large?: boolean;
  transparent?: boolean;
}

export function Header({
  title,
  subtitle,
  showBack,
  onBack,
  right,
  large,
  transparent,
}: HeaderProps) {
  const { colors, spacing, typography, radius } = useTheme();

  return (
    <MotiView
      from={{ opacity: 0, translateY: -8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 320 }}
      style={[
        styles.container,
        {
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          backgroundColor: transparent ? "transparent" : colors.bg,
        },
      ]}
    >
      <View style={styles.leftRow}>
        {showBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.backBtn,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.pill,
                borderColor: colors.border,
                marginRight: spacing.md,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : null}

        <View style={styles.titleWrap}>
          {title ? (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: large
                  ? typography.fonts.headingBold
                  : typography.fonts.heading,
                fontSize: large ? typography.sizes.xxl : typography.sizes.xl,
                color: colors.text,
              }}
            >
              {title}
            </Text>
          ) : null}
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
      </View>

      {right ? <View style={styles.rightWrap}>{right}</View> : null}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  titleWrap: {
    flex: 1,
  },
  rightWrap: {
    marginLeft: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  } as StyleProp<ViewStyle> as ViewStyle,
});
