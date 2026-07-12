import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/theme/ThemeContext";
import { usePendingRequestCount } from "@/hooks/usePendingRequestCount";
import { MainTabParamList } from "@/navigation/types";

import Home from "@/screens/Home/Home";
import Bookings from "@/screens/Bookings/Bookings";
import Post from "@/screens/Post/Post";
import Wallet from "@/screens/Wallet/Wallet";
import Profile from "@/screens/Profile/Profile";

const Tab = createBottomTabNavigator<MainTabParamList>();

type TabMeta = {
  name: keyof MainTabParamList;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  center?: boolean;
};

const TABS: TabMeta[] = [
  { name: "Home", label: "Home", icon: "home-outline", iconActive: "home" },
  {
    name: "Bookings",
    label: "Bookings",
    icon: "car-outline",
    iconActive: "car",
  },
  {
    name: "Post",
    label: "My Space",
    icon: "add",
    iconActive: "add",
    center: true,
  },
  {
    name: "Wallet",
    label: "Wallet",
    icon: "wallet-outline",
    iconActive: "wallet",
  },
  {
    name: "Profile",
    label: "Profile",
    icon: "person-outline",
    iconActive: "person",
  },
];

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  // Gentle cross-tab badge poll (60s, foreground-only). The My Space screen
  // refreshes its own list faster while open; the badge just needs to catch a
  // new request when the host is on another tab.
  const pendingRequests = usePendingRequestCount(60000);

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          ...shadows.lg,
        },
      ]}
    >
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const meta =
            TABS.find((t) => t.name === route.name) ?? TABS[index] ?? TABS[0];
          const isFocused = state.index === index;

          const onPress = () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {
              // haptics unsupported — ignore
            }
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: "tabLongPress", target: route.key });
          };

          if (meta.center) {
            return (
              <View key={route.key} style={styles.centerSlot}>
                <Pressable
                  onPress={onPress}
                  onLongPress={onLongPress}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={`${meta.label} tab`}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.centerButton,
                    {
                      backgroundColor: colors.primary,
                      borderColor: colors.surface,
                      transform: [{ scale: pressed ? 0.94 : 1 }],
                      ...shadows.md,
                    },
                  ]}
                >
                  <Ionicons
                    name={isFocused ? meta.iconActive : meta.icon}
                    size={24}
                    color={colors.white}
                  />
                  {pendingRequests > 0 ? (
                    <View style={[styles.badge, { backgroundColor: colors.error ?? "#E5484D", borderColor: colors.surface }]}>
                      <Text style={styles.badgeText}>
                        {pendingRequests > 9 ? "9+" : pendingRequests}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.centerLabel,
                    {
                      color: isFocused ? colors.primary : colors.textMuted,
                      fontFamily: typography.fonts.bodyMedium,
                      fontSize: typography.sizes.xs - 1,
                    },
                  ]}
                >
                  {meta.label}
                </Text>
              </View>
            );
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={`${meta.label} tab`}
              hitSlop={8}
              style={({ pressed }) => [
                styles.tab,
                { transform: [{ scale: pressed ? 0.92 : 1 }] },
              ]}
            >
              <Ionicons
                name={isFocused ? meta.iconActive : meta.icon}
                size={22}
                color={isFocused ? colors.primary : colors.textMuted}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  {
                    color: isFocused ? colors.primary : colors.textMuted,
                    fontFamily: isFocused
                      ? typography.fonts.bodySemi
                      : typography.fonts.bodyMedium,
                    fontSize: typography.sizes.xs - 1,
                  },
                ]}
              >
                {meta.label}
              </Text>
              {isFocused ? (
                <View
                  style={[
                    styles.activeDot,
                    { backgroundColor: colors.primary },
                  ]}
                />
              ) : (
                <View style={styles.activeDotPlaceholder} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Bookings" component={Bookings} />
      <Tab.Screen name="Post" component={Post} />
      <Tab.Screen name="Wallet" component={Wallet} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 8,
    ...Platform.select({
      android: { elevation: 12 },
      default: {},
    }),
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 3,
  },
  label: {
    letterSpacing: 0.2,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginTop: 1,
  },
  activeDotPlaceholder: {
    width: 5,
    height: 5,
    marginTop: 1,
  },
  centerSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
  },
  centerButton: {
    width: 54,
    height: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    marginTop: -22,
  },
  centerLabel: {
    letterSpacing: 0.2,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
});
