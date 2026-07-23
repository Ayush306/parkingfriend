import React from "react";
import {
  StyleProp,
  ScrollView,
  RefreshControl,
  View,
  ViewStyle,
  StyleSheet,
} from "react-native";
import { SafeAreaView, Edge } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeContext";
import { KeyboardAvoider } from "@/components/ui/KeyboardAvoider";

export interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  refreshing,
  onRefresh,
  style,
  edges = ["top", "left", "right"],
}: ScreenProps) {
  const { colors, spacing } = useTheme();

  const paddingStyle: ViewStyle = padded
    ? { paddingHorizontal: spacing.xl }
    : {};

  if (scroll) {
    return (
      <SafeAreaView
        edges={edges}
        style={[styles.flex, { backgroundColor: colors.bg }]}
      >
        {/* Keyboard-aware: on a form the ScrollView viewport shrinks above the
            keyboard so EVERY field stays reachable by scrolling — the fix for
            Android edge-to-edge, where the window no longer auto-resizes. */}
        <KeyboardAvoider style={styles.flex}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.scrollContent,
              paddingStyle,
              style as ViewStyle,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={!!refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                  progressBackgroundColor={colors.surface}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        </KeyboardAvoider>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.flex, { backgroundColor: colors.bg }]}
    >
      <View style={[styles.flex, paddingStyle, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
});
