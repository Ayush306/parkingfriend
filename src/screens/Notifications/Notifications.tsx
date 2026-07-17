import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/theme/ThemeContext";
import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useAsync } from "@/hooks/useAsync";
import { notificationService } from "@/services/notificationService";
import { haptics } from "@/utils/haptics";
import type { NotificationItem } from "@/models/types";

type NotifType = NotificationItem["type"];

const TYPE_TINT: Record<NotifType, "primary" | "accent" | "secondary" | "info"> = {
  booking: "primary",
  offer: "accent",
  host: "secondary",
  system: "info",
};

function useTypeColor() {
  const { colors } = useTheme();
  return (type: NotifType): string => {
    switch (TYPE_TINT[type]) {
      case "accent":
        return colors.accent;
      case "secondary":
        return colors.secondary;
      case "info":
        return colors.info;
      case "primary":
      default:
        return colors.primary;
    }
  };
}

/** A notification's own icon may not exist in the current icon set; fall back per type. */
function resolveIcon(item: NotificationItem): keyof typeof Ionicons.glyphMap {
  const name = item.icon as keyof typeof Ionicons.glyphMap;
  if (name && (Ionicons.glyphMap as Record<string, number>)[name] != null) {
    return name;
  }
  const fallback: Record<NotifType, keyof typeof Ionicons.glyphMap> = {
    booking: "calendar",
    offer: "pricetag",
    host: "home",
    system: "notifications",
  };
  return fallback[item.type];
}

/** "Today" = very recent relative labels; everything else is "Earlier". */
function isToday(item: NotificationItem): boolean {
  const t = (item.time || "").toLowerCase();
  return (
    t.includes("now") ||
    t.includes("min") ||
    t.includes("hour") ||
    t.includes("hr") ||
    t === "today"
  );
}

function NotificationRow({
  item,
  index,
  tint,
  onPress,
}: {
  item: NotificationItem;
  index: number;
  tint: string;
  onPress: (item: NotificationItem) => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const unread = !item.read;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 300, delay: index * 45 }}
    >
      <Pressable
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.message}`}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: unread ? colors.primaryLight : colors.surface,
            borderRadius: radius.lg,
            padding: spacing.md,
            marginBottom: spacing.md,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: unread ? "transparent" : colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: tint + "1F",
              borderRadius: radius.md,
              marginRight: spacing.md,
            },
          ]}
        >
          <Ionicons name={resolveIcon(item)} size={22} color={tint} />
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                color: colors.text,
                fontFamily: unread
                  ? typography.fonts.bodySemi
                  : typography.fonts.bodyMedium,
                fontSize: typography.sizes.md,
              }}
            >
              {item.title}
            </Text>
            {unread ? (
              <View
                style={[styles.unreadDot, { backgroundColor: colors.primary }]}
              />
            ) : null}
          </View>

          <Text
            numberOfLines={2}
            style={{
              marginTop: 3,
              color: colors.textSecondary,
              fontFamily: typography.fonts.body,
              fontSize: typography.sizes.sm,
              lineHeight: 19,
            }}
          >
            {item.message}
          </Text>

          <Text
            style={{
              marginTop: spacing.sm,
              color: colors.textMuted,
              fontFamily: typography.fonts.body,
              fontSize: typography.sizes.xs,
            }}
          >
            {item.time}
          </Text>
        </View>
      </Pressable>
    </MotiView>
  );
}

export default function Notifications() {
  const navigation = useNavigation<any>();
  const { colors, spacing, typography } = useTheme();
  const toast = useToast();
  const getTint = useTypeColor();
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const { data, loading, error, refetch, setData } = useAsync<
    NotificationItem[]
  >(() => notificationService.list(), []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.light();
    await Promise.resolve(refetch());
    setTimeout(() => setRefreshing(false), 650);
  }, [refetch]);

  const unreadCount = useMemo(
    () => (data ?? []).filter((n) => !n.read).length,
    [data]
  );

  const { today, earlier } = useMemo(() => {
    const list = data ?? [];
    return {
      today: list.filter(isToday),
      earlier: list.filter((n) => !isToday(n)),
    };
  }, [data]);

  const handleRowPress = useCallback(
    (item: NotificationItem) => {
      if (!item.read) {
        // optimistic single-item read
        setData((prev) =>
          (prev ?? []).map((n) => (n.id === item.id ? { ...n, read: true } : n))
        );
        void notificationService.markRead(item.id);
      }
      // Every notification takes you straight to where you can ACT on it:
      //   new request       → Booking requests (accept/decline there)
      //   accepted/declined → My bookings
      //   rating reminder   → My bookings (rate host) / My Space (rate guest)
      if (item.id.startsWith("evt_req_")) {
        haptics.light();
        navigation.navigate("HostRequests");
      } else if (item.id.startsWith("evt_bk_")) {
        haptics.light();
        navigation.navigate("Main", { screen: "Bookings" });
      } else if (item.id.startsWith("rate_")) {
        haptics.light();
        navigation.navigate("Main", {
          screen: item.id.startsWith("rate_host") ? "Post" : "Bookings",
        });
      }
    },
    [setData, navigation]
  );

  const handleMarkAll = useCallback(async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    haptics.light();
    setData((prev) => (prev ?? []).map((n) => ({ ...n, read: true })));
    try {
      await notificationService.markAllRead();
      toast.show("All notifications marked as read", "success");
    } catch {
      toast.show("Couldn't update. Please try again.", "error");
      void Promise.resolve(refetch());
    } finally {
      setMarkingAll(false);
    }
  }, [markingAll, unreadCount, setData, toast, refetch]);

  const renderSection = (
    label: string,
    items: NotificationItem[],
    offset: number
  ) => {
    if (items.length === 0) return null;
    return (
      <View style={{ marginBottom: spacing.lg }}>
        <Text
          style={{
            marginBottom: spacing.md,
            color: colors.textSecondary,
            fontFamily: typography.fonts.bodySemi,
            fontSize: typography.sizes.xs,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        {items.map((item, i) => (
          <NotificationRow
            key={item.id}
            item={item}
            index={offset + i}
            tint={getTint(item.type)}
            onPress={handleRowPress}
          />
        ))}
      </View>
    );
  };

  const renderContent = () => {
    if (loading && !data) {
      return (
        <View>
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                marginBottom: spacing.md,
                padding: spacing.md,
                backgroundColor: colors.surface,
                borderRadius: 16,
              }}
            >
              <Skeleton
                width={44}
                height={44}
                radius={12}
                style={{ marginRight: spacing.md }}
              />
              <View style={{ flex: 1 }}>
                <Skeleton width="55%" height={15} />
                <View style={{ height: spacing.sm }} />
                <Skeleton width="90%" height={12} />
                <View style={{ height: spacing.sm }} />
                <Skeleton width="30%" height={10} />
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (error && !data) {
      return <ErrorState onRetry={refetch} />;
    }

    const list = data ?? [];
    if (list.length === 0) {
      return (
        <EmptyState
          title="You're all caught up"
          subtitle="Booking updates, offers and host requests will show up here."
        />
      );
    }

    return (
      <View style={{ marginTop: spacing.sm }}>
        {renderSection("Today", today, 0)}
        {renderSection("Earlier", earlier, today.length)}
      </View>
    );
  };

  const markAllAction =
    !loading && !error && unreadCount > 0 ? (
      <Pressable
        onPress={handleMarkAll}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Mark all as read"
        style={({ pressed }) => [
          styles.markAllBtn,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Ionicons name="checkmark-done" size={16} color={colors.primary} />
        <Text
          style={{
            marginLeft: 6,
            color: colors.primary,
            fontFamily: typography.fonts.bodySemi,
            fontSize: typography.sizes.xs,
          }}
        >
          Mark all read
        </Text>
      </Pressable>
    ) : undefined;

  return (
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh}>
      <Header
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread`
            : "Stay on top of your bookings"
        }
        showBack
        onBack={() => navigation.goBack()}
        right={markAllAction}
      />
      {renderContent()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
