import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { walletService } from "@/services/walletService";
import { formatCurrency, formatDate } from "@/utils/format";
import { haptics } from "@/utils/haptics";
import { useTheme } from "@/theme/ThemeContext";
import type { EarningEntry, WalletSummary } from "@/models/types";

interface WalletData {
  summary: WalletSummary;
  entries: EarningEntry[];
}

async function loadWallet(): Promise<WalletData> {
  const [summary, entries] = await Promise.all([
    walletService.getSummary(),
    walletService.getEntries(),
  ]);
  // Host-only wallet: keep just the profit earned from hosting.
  return { summary, entries: entries.filter((e) => e.kind === "earning") };
}

/** A single host-earning row in the activity feed. */
function EarningRow({ entry, index }: { entry: EarningEntry; index: number }) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 320, delay: index * 45 }}
      style={[styles.entryRow, { paddingVertical: spacing.md }]}
    >
      <View
        style={[
          styles.entryIcon,
          { backgroundColor: colors.success + "1A", borderRadius: radius.md, marginRight: spacing.md },
        ]}
      >
        <Ionicons name="trending-up" size={22} color={colors.success} />
      </View>

      <View style={styles.entryBody}>
        <Text
          numberOfLines={1}
          style={{ color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.md }}
        >
          {entry.title}
        </Text>
        <Text
          numberOfLines={1}
          style={{ marginTop: 2, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}
        >
          {entry.subtitle}
        </Text>
        <Text
          numberOfLines={1}
          style={{ marginTop: 2, color: colors.textMuted, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}
        >
          {formatDate(entry.date)}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end", marginLeft: spacing.sm }}>
        <Text style={{ color: colors.success, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.md }}>
          +{formatCurrency(entry.amount)}
        </Text>
        <Text style={{ marginTop: 2, color: colors.textMuted, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}>
          earned
        </Text>
      </View>
    </MotiView>
  );
}

export default function Wallet() {
  const { colors, spacing, radius, typography, gradients, shadows } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const { data, loading, error, refetch } = useAsync<WalletData>(loadWallet, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.light();
    await Promise.resolve(refetch());
    setTimeout(() => setRefreshing(false), 650);
  }, [refetch]);

  const summary = data?.summary;
  const entries = data?.entries ?? [];

  const renderHeroCard = () => {
    if (loading && !data) {
      return (
        <View
          style={[
            styles.heroSkeleton,
            { backgroundColor: colors.surfaceAlt, borderRadius: radius.xxl, padding: spacing.xl },
          ]}
        >
          <Skeleton width="45%" height={14} />
          <View style={{ height: spacing.md }} />
          <Skeleton width="55%" height={34} radius={radius.md} />
          <View style={{ height: spacing.xl }} />
          <Skeleton width="80%" height={40} radius={radius.md} />
        </View>
      );
    }

    return (
      <MotiView
        from={{ opacity: 0, translateY: 12, scale: 0.98 }}
        animate={{ opacity: 1, translateY: 0, scale: 1 }}
        transition={{ type: "timing", duration: 420 }}
        style={[shadows.lg, { borderRadius: radius.xxl }]}
      >
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroCard, { borderRadius: radius.xxl, padding: spacing.xl }]}
        >
          <View pointerEvents="none" style={[styles.decorCircle, { top: -40, right: -30 }]} />
          <View pointerEvents="none" style={[styles.decorCircleSmall, { bottom: -20, left: -10 }]} />

          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: "rgba(255,255,255,0.85)",
                  fontFamily: typography.fonts.bodyMedium,
                  fontSize: typography.sizes.sm,
                  letterSpacing: 0.3,
                }}
              >
                Earned as a host
              </Text>
              <Text
                style={{
                  marginTop: spacing.sm,
                  color: "#FFFFFF",
                  fontFamily: typography.fonts.headingBold,
                  fontSize: typography.sizes.display,
                }}
              >
                {formatCurrency(summary?.earningsLifetime ?? 0)}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  color: "rgba(255,255,255,0.8)",
                  fontFamily: typography.fonts.body,
                  fontSize: typography.sizes.xs,
                }}
              >
                Total profit · {summary?.completedAsHost ?? 0} completed bookings
              </Text>
            </View>

            <View style={styles.heroBadge}>
              <Ionicons name="home" size={22} color="#FFFFFF" />
            </View>
          </View>

          <View style={[styles.miniStatRow, { marginTop: spacing.xl }]}>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatValue}>
                {formatCurrency(summary?.earningsLast3Months ?? 0)}
              </Text>
              <Text style={styles.miniStatLabel}>Last 3 months</Text>
            </View>
            <View style={styles.miniStatDivider} />
            <View style={styles.miniStat}>
              <Text style={styles.miniStatValue}>{summary?.completedAsHost ?? 0}</Text>
              <Text style={styles.miniStatLabel}>Bookings hosted</Text>
            </View>
          </View>
        </LinearGradient>
      </MotiView>
    );
  };

  const renderActivity = () => {
    if (loading && !data) {
      return (
        <View>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={[styles.entryRow, { paddingVertical: spacing.md }]}>
              <Skeleton width={44} height={44} radius={radius.md} style={{ marginRight: spacing.md }} />
              <View style={{ flex: 1 }}>
                <Skeleton width="70%" height={15} />
                <View style={{ height: spacing.sm }} />
                <Skeleton width="45%" height={12} />
              </View>
              <Skeleton width={56} height={16} />
            </View>
          ))}
        </View>
      );
    }

    if (error && !data) {
      return <ErrorState onRetry={refetch} />;
    }

    if (entries.length === 0) {
      return (
        <EmptyState
          title="No earnings yet"
          subtitle="Once someone completes a booking on a space you've listed, your profit shows up here."
        />
      );
    }

    return (
      <View
        style={[
          styles.activityCard,
          { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.lg, ...shadows.sm },
        ]}
      >
        {entries.map((entry, i) => (
          <View key={entry.id}>
            {i > 0 ? (
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
            ) : null}
            <EarningRow entry={entry} index={i} />
          </View>
        ))}
      </View>
    );
  };

  return (
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh} padded={false}>
      <Header title="Wallet" large />

      <View style={{ paddingHorizontal: spacing.xl }}>
        {renderHeroCard()}

        {/* No-payment reassurance */}
        <View style={[styles.note, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, marginTop: spacing.lg }]}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
          <Text
            style={{
              marginLeft: spacing.sm,
              flex: 1,
              color: colors.textSecondary,
              fontFamily: typography.fonts.body,
              fontSize: typography.sizes.xs,
            }}
          >
            Parkmitter never handles your money. Guests settle directly with you — this is just your earnings tracker.
          </Text>
        </View>

        <View style={{ height: spacing.xxl }} />

        <SectionHeader title="Recent earnings" />

        {renderActivity()}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    overflow: "hidden",
  },
  heroSkeleton: {
    width: "100%",
  },
  decorCircle: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  decorCircleSmall: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  heroBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  miniStatRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 16,
    padding: 12,
  },
  miniStat: {
    flex: 1,
    alignItems: "center",
  },
  miniStatValue: {
    color: "#FFFFFF",
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
  },
  miniStatLabel: {
    marginTop: 2,
    color: "rgba(255,255,255,0.8)",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  miniStatDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.35)",
    marginVertical: 2,
  },
  note: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  activityCard: {
    overflow: "hidden",
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  entryIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  entryBody: {
    flex: 1,
  },
});
