import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { MotiView } from "moti";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Svg, {
  Rect,
  Line,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from "react-native-svg";

import { useTheme } from "@/theme/ThemeContext";
import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Divider } from "@/components/ui/Divider";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAsync } from "@/hooks/useAsync";
import { simulate } from "@/services/mockClient";
import { formatCurrency } from "@/utils/format";
import { haptics } from "@/utils/haptics";

type Range = "Week" | "Month";

interface ChartBar {
  label: string;
  value: number;
}

interface BreakdownItem {
  spotTitle: string;
  station: string;
  bookings: number;
  earnings: number;
  occupancy: number;
}

interface ReportData {
  earnings: number;
  earningsDelta: number;
  bookings: number;
  bookingsDelta: number;
  occupancy: number;
  occupancyDelta: number;
  chart: ChartBar[];
  breakdown: BreakdownItem[];
}

const WEEK_DATA: ReportData = {
  earnings: 4820,
  earningsDelta: 12,
  bookings: 18,
  bookingsDelta: 8,
  occupancy: 74,
  occupancyDelta: 5,
  chart: [
    { label: "Mon", value: 620 },
    { label: "Tue", value: 880 },
    { label: "Wed", value: 540 },
    { label: "Thu", value: 960 },
    { label: "Fri", value: 720 },
    { label: "Sat", value: 640 },
    { label: "Sun", value: 460 },
  ],
  breakdown: [
    {
      spotTitle: "Covered driveway near HUDA",
      station: "Huda City Centre",
      bookings: 9,
      earnings: 2640,
      occupancy: 82,
    },
    {
      spotTitle: "Basement slot · Sohna Road",
      station: "Sohna Road",
      bookings: 6,
      earnings: 1580,
      occupancy: 68,
    },
    {
      spotTitle: "Open lot near IFFCO Chowk",
      station: "IFFCO Chowk",
      bookings: 3,
      earnings: 600,
      occupancy: 54,
    },
  ],
};

const MONTH_DATA: ReportData = {
  earnings: 19240,
  earningsDelta: 18,
  bookings: 76,
  bookingsDelta: 14,
  occupancy: 71,
  occupancyDelta: -3,
  chart: [
    { label: "W1", value: 4200 },
    { label: "W2", value: 5600 },
    { label: "W3", value: 4820 },
    { label: "W4", value: 4620 },
  ],
  breakdown: [
    {
      spotTitle: "Covered driveway near HUDA",
      station: "Huda City Centre",
      bookings: 34,
      earnings: 9860,
      occupancy: 79,
    },
    {
      spotTitle: "Basement slot · Sohna Road",
      station: "Sohna Road",
      bookings: 27,
      earnings: 6420,
      occupancy: 72,
    },
    {
      spotTitle: "Open lot near IFFCO Chowk",
      station: "IFFCO Chowk",
      bookings: 15,
      earnings: 2960,
      occupancy: 61,
    },
  ],
};

/** Mock host-analytics fetch. When forceFail is set, always rejects. */
async function fetchReport(range: Range, forceFail: boolean): Promise<ReportData> {
  const data = range === "Week" ? WEEK_DATA : MONTH_DATA;
  // Explicit error-demo path uses failRate:1 so it deterministically fails.
  return simulate(data, forceFail ? { failRate: 1 } : {});
}

export default function Reports() {
  const navigation = useNavigation<any>();
  const { colors, spacing, typography, radius } = useTheme();

  const [range, setRange] = useState<Range>("Week");
  const [demoError, setDemoError] = useState(false);

  const { data, loading, error, refetch } = useAsync<ReportData>(
    () => fetchReport(range, demoError),
    [range, demoError]
  );

  const onRetry = useCallback(() => {
    // Clear the forced-error flag so retry goes back to the happy path.
    if (demoError) {
      setDemoError(false);
    } else {
      refetch();
    }
  }, [demoError, refetch]);

  const triggerErrorDemo = useCallback(() => {
    haptics.warning();
    setDemoError(true);
  }, []);

  return (
    <Screen scroll padded refreshing={loading && !!data} onRefresh={refetch}>
      <Header
        title="My reports"
        subtitle="Host earnings & insights"
        showBack
        onBack={() => navigation.goBack()}
        right={
          <Pressable
            onPress={triggerErrorDemo}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Simulate a loading error"
            style={({ pressed }) => [
              styles.demoBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.pill,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="alert-triangle" size={16} color={colors.warning} />
          </Pressable>
        }
      />

      {/* Range switch */}
      <View style={{ marginTop: spacing.sm }}>
        <SegmentedControl
          options={["Week", "Month"]}
          value={range}
          onChange={(v) => setRange(v as Range)}
        />
      </View>

      {error ? (
        <ErrorState
          title="Couldn't load reports"
          subtitle="We hit a snag fetching your analytics. Give it another try."
          onRetry={onRetry}
          style={{ marginTop: spacing.huge }}
        />
      ) : loading && !data ? (
        <ReportsSkeleton />
      ) : data ? (
        <>
          {/* Summary metrics */}
          <View style={{ marginTop: spacing.xl }}>
            <MetricCard
              icon="cash-outline"
              tint={colors.primary}
              label="Total earnings"
              value={formatCurrency(data.earnings)}
              delta={data.earningsDelta}
              range={range}
              delay={0}
              large
            />
            <View style={styles.metricRow}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <MetricCard
                  icon="calendar-outline"
                  tint={colors.secondary}
                  label="Bookings"
                  value={`${data.bookings}`}
                  delta={data.bookingsDelta}
                  range={range}
                  delay={80}
                />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <MetricCard
                  icon="pie-chart-outline"
                  tint={colors.accent}
                  label="Occupancy"
                  value={`${data.occupancy}%`}
                  delta={data.occupancyDelta}
                  range={range}
                  delay={140}
                />
              </View>
            </View>
          </View>

          {/* Bar chart */}
          <MotiView
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 420, delay: 180 }}
            style={{ marginTop: spacing.lg }}
          >
            <Card>
              <View style={styles.chartHead}>
                <Text
                  style={{
                    fontFamily: typography.fonts.heading,
                    fontSize: typography.sizes.lg,
                    color: colors.text,
                  }}
                >
                  Earnings trend
                </Text>
                <Badge
                  label={range === "Week" ? "Last 7 days" : "Last 4 weeks"}
                  tone="neutral"
                  size="sm"
                />
              </View>
              <BarChart bars={data.chart} />
            </Card>
          </MotiView>

          {/* Breakdown */}
          <MotiView
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 420, delay: 240 }}
            style={{ marginTop: spacing.lg }}
          >
            <Text
              style={{
                fontFamily: typography.fonts.heading,
                fontSize: typography.sizes.lg,
                color: colors.text,
                marginBottom: spacing.md,
              }}
            >
              By listing
            </Text>
            <Card padded={false} style={{ paddingVertical: spacing.xs }}>
              {data.breakdown.map((item, i) => (
                <View key={item.spotTitle}>
                  <BreakdownRow item={item} />
                  {i < data.breakdown.length - 1 ? (
                    <Divider inset={spacing.lg} />
                  ) : null}
                </View>
              ))}
            </Card>
          </MotiView>

          <Text
            style={{
              textAlign: "center",
              marginTop: spacing.xl,
              fontFamily: typography.fonts.body,
              fontSize: typography.sizes.xs,
              color: colors.textMuted,
            }}
          >
            Figures are estimates and update through the day.
          </Text>
        </>
      ) : null}
    </Screen>
  );
}

interface MetricCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  value: string;
  delta: number;
  range: Range;
  delay?: number;
  large?: boolean;
}

function MetricCard({
  icon,
  tint,
  label,
  value,
  delta,
  range,
  delay = 0,
  large,
}: MetricCardProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const up = delta >= 0;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 400, delay }}
    >
      <Card>
        <View style={styles.metricTop}>
          <View
            style={[
              styles.metricIcon,
              { backgroundColor: tint + "1A", borderRadius: radius.md },
            ]}
          >
            <Ionicons name={icon} size={20} color={tint} />
          </View>
          <View
            style={[
              styles.deltaPill,
              {
                backgroundColor: up
                  ? colors.success + "1A"
                  : colors.error + "1A",
                borderRadius: radius.pill,
              },
            ]}
          >
            <Ionicons
              name={up ? "arrow-up" : "arrow-down"}
              size={12}
              color={up ? colors.success : colors.error}
            />
            <Text
              style={{
                marginLeft: 2,
                fontFamily: typography.fonts.bodySemi,
                fontSize: typography.sizes.xs,
                color: up ? colors.success : colors.error,
              }}
            >
              {Math.abs(delta)}%
            </Text>
          </View>
        </View>

        <Text
          style={{
            marginTop: spacing.md,
            fontFamily: typography.fonts.headingBold,
            fontSize: large ? typography.sizes.xxxl : typography.sizes.xxl,
            color: colors.text,
          }}
        >
          {value}
        </Text>
        <Text
          style={{
            marginTop: 2,
            fontFamily: typography.fonts.body,
            fontSize: typography.sizes.sm,
            color: colors.textSecondary,
          }}
        >
          {label} · this {range.toLowerCase()}
        </Text>
      </Card>
    </MotiView>
  );
}

interface BarChartProps {
  bars: ChartBar[];
}

/** A lightweight animated bar chart drawn with react-native-svg. */
function BarChart({ bars }: BarChartProps) {
  const { colors, spacing, typography } = useTheme();

  const CHART_W = 300;
  const CHART_H = 150;
  const PAD_BOTTOM = 4;
  const max = Math.max(...bars.map((b) => b.value), 1);
  const count = bars.length;
  const gap = 14;
  const barW = (CHART_W - gap * (count - 1)) / count;

  // three subtle gridlines
  const gridlines = [0.25, 0.5, 0.75, 1].map((f) => CHART_H - CHART_H * f);

  return (
    <View style={{ marginTop: spacing.lg }}>
      <Svg width="100%" height={CHART_H + 4} viewBox={`0 0 ${CHART_W} ${CHART_H + PAD_BOTTOM}`}>
        <Defs>
          <SvgLinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={1} />
            <Stop offset="1" stopColor={colors.primaryDark} stopOpacity={0.85} />
          </SvgLinearGradient>
        </Defs>

        {gridlines.map((y, i) => (
          <Line
            key={`g${i}`}
            x1={0}
            y1={y}
            x2={CHART_W}
            y2={y}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray="3 5"
          />
        ))}

        {bars.map((bar, i) => {
          const h = Math.max((bar.value / max) * (CHART_H - 10), 3);
          const x = i * (barW + gap);
          const y = CHART_H - h;
          const isPeak = bar.value === max;
          return (
            <Rect
              key={bar.label}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={6}
              fill={isPeak ? "url(#barGrad)" : colors.primaryLight}
            />
          );
        })}
      </Svg>

      {/* x-axis labels */}
      <View style={styles.axisRow}>
        {bars.map((bar) => {
          const isPeak = bar.value === max;
          return (
            <Text
              key={bar.label}
              style={{
                flex: 1,
                textAlign: "center",
                fontFamily: isPeak
                  ? typography.fonts.bodySemi
                  : typography.fonts.body,
                fontSize: typography.sizes.xs,
                color: isPeak ? colors.primary : colors.textMuted,
              }}
            >
              {bar.label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

interface BreakdownRowProps {
  item: BreakdownItem;
}

function BreakdownRow({ item }: BreakdownRowProps) {
  const { colors, spacing, typography, radius } = useTheme();
  return (
    <View style={[styles.breakdownRow, { padding: spacing.lg }]}>
      <View style={{ flex: 1, marginRight: spacing.md }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: typography.fonts.bodySemi,
            fontSize: typography.sizes.md,
            color: colors.text,
          }}
        >
          {item.spotTitle}
        </Text>
        <View style={styles.breakdownMeta}>
          <Ionicons name="train-outline" size={13} color={colors.textMuted} />
          <Text
            style={{
              marginLeft: 4,
              fontFamily: typography.fonts.body,
              fontSize: typography.sizes.xs,
              color: colors.textSecondary,
            }}
          >
            {item.station} · {item.bookings} bookings
          </Text>
        </View>
        {/* occupancy bar */}
        <View
          style={[
            styles.occTrack,
            { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill },
          ]}
        >
          <View
            style={{
              width: `${Math.min(100, item.occupancy)}%`,
              height: "100%",
              backgroundColor: colors.primary,
              borderRadius: radius.pill,
            }}
          />
        </View>
        <Text
          style={{
            marginTop: 4,
            fontFamily: typography.fonts.body,
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
          }}
        >
          {item.occupancy}% occupancy
        </Text>
      </View>

      <Text
        style={{
          fontFamily: typography.fonts.headingBold,
          fontSize: typography.sizes.lg,
          color: colors.primary,
        }}
      >
        {formatCurrency(item.earnings)}
      </Text>
    </View>
  );
}

function ReportsSkeleton() {
  const { spacing, radius } = useTheme();
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Skeleton height={120} radius={radius.lg} />
      <View style={[styles.metricRow, { marginTop: 0 }]}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <Skeleton height={110} radius={radius.lg} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Skeleton height={110} radius={radius.lg} />
        </View>
      </View>
      <View style={{ marginTop: spacing.lg }}>
        <Skeleton height={210} radius={radius.lg} />
      </View>
      <View style={{ marginTop: spacing.lg }}>
        <Skeleton height={72} radius={radius.lg} />
        <View style={{ height: spacing.md }} />
        <Skeleton height={72} radius={radius.lg} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  demoBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  metricRow: {
    flexDirection: "row",
    marginTop: 16,
  },
  metricTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  deltaPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chartHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  axisRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  breakdownMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  occTrack: {
    height: 6,
    marginTop: 10,
    overflow: "hidden",
  },
});
