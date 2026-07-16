import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Linking,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Divider } from "@/components/ui/Divider";
import { MapPreview } from "@/components/ui/MapPreview";
import { LiveMap } from "@/components/ui/LiveMap";
import { CancelReasonSheet } from "@/components/ui/CancelReasonSheet";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { SpotGraphic } from "@/components/ui/SpotGraphic";
import { useToast } from "@/components/ui/Toast";

import { useTheme } from "@/theme/ThemeContext";
import { useAsync } from "@/hooks/useAsync";
import { bookingService } from "@/services/bookingService";
import type { Booking } from "@/models/types";
import { formatCurrency, formatDate } from "@/utils/format";
import { haptics } from "@/utils/haptics";
import { openDirections } from "@/utils/directions";

/** Renders a "HH:mm" 24h string as friendly 12h label. */
function label12h(hhmm?: string): string {
  if (!hhmm) return "--";
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const meridiem = h >= 12 ? "PM" : "AM";
  let hour = h % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${(m || 0).toString().padStart(2, "0")} ${meridiem}`;
}

const STATUS_TONE: Record<
  Booking["status"],
  "primary" | "success" | "warning" | "error" | "neutral"
> = {
  pending: "warning",
  confirmed: "primary",
  active: "success",
  completed: "neutral",
  cancelled: "error",
};

const STATUS_LABEL: Record<Booking["status"], string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

interface TimelineStep {
  key: string;
  title: string;
  desc: string;
}

/** Builds the vertical status timeline for a booking. */
function buildTimeline(status: Booking["status"]): {
  steps: TimelineStep[];
  currentIndex: number;
  cancelled: boolean;
} {
  const base: TimelineStep[] = [
    { key: "booked", title: "Booking placed", desc: "Request sent & spot reserved" },
    { key: "confirmed", title: "Host confirmed", desc: "Your spot is locked in" },
    { key: "active", title: "Parking active", desc: "Use your OTP to check in" },
    { key: "completed", title: "Completed", desc: "Session wrapped up" },
  ];

  if (status === "cancelled") {
    return {
      steps: [
        base[0],
        { key: "cancelled", title: "Cancelled", desc: "This booking was cancelled" },
      ],
      currentIndex: 1,
      cancelled: true,
    };
  }

  const order: Record<Exclude<Booking["status"], "cancelled">, number> = {
    pending: 0,
    confirmed: 1,
    active: 2,
    completed: 3,
  };
  return {
    steps: base,
    currentIndex: order[status as Exclude<Booking["status"], "cancelled">] ?? 0,
    cancelled: false,
  };
}

export default function BookingDetail() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id: string = (route.params as any)?.id ?? "";
  const { colors, spacing, typography, radius } = useTheme();
  const toast = useToast();

  const { data, loading, error, refetch, setData } = useAsync<Booking | null>(
    () => bookingService.getById(id),
    [id]
  );

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const booking = data;
  const timeline = useMemo(
    () => (booking ? buildTimeline(booking.status) : null),
    [booking]
  );

  const canCancel =
    booking && (booking.status === "confirmed" || booking.status === "pending");
  const contactUnlocked = booking?.contactUnlocked ?? false;

  const getDirections = async () => {
    haptics.light();
    const opened = await openDirections(booking!.spot.latitude, booking!.spot.longitude);
    if (!opened) {
      toast.show("Couldn't open Google Maps on this device.", "error");
    }
  };

  const callHost = () => {
    const number = "+919811024567";
    haptics.light();
    Linking.openURL(`tel:${number}`).catch(() =>
      toast.show("Couldn't open the dialer on this device.", "error")
    );
  };

  const doCancel = async (reason: string) => {
    if (!booking) return;
    setCancelling(true);
    try {
      const updated = await bookingService.cancel(booking.id, reason);
      setConfirmVisible(false);
      setData(updated);
      haptics.success();
      toast.show("Booking cancelled. Your spot has been released.", "success");
    } catch (e: any) {
      haptics.error();
      toast.show(e?.message ?? "Couldn't cancel this booking.", "error");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Header title="Booking details" showBack onBack={() => navigation.goBack()} />
        <View style={{ marginTop: spacing.md }}>
          <SkeletonCard />
          <View style={{ height: spacing.lg }} />
          <SkeletonCard />
        </View>
      </Screen>
    );
  }

  if (error || !booking) {
    return (
      <Screen>
        <Header title="Booking details" showBack onBack={() => navigation.goBack()} />
        <ErrorState
          title="Booking not found"
          subtitle={error ?? "We couldn't load this booking."}
          onRetry={refetch}
          style={{ flex: 1 }}
        />
      </Screen>
    );
  }

  const host = booking.spot.host;

  return (
    <Screen scroll padded onRefresh={refetch}>
      <Header
        title="Booking details"
        showBack
        onBack={() => navigation.goBack()}
        right={<Badge label={STATUS_LABEL[booking.status]} tone={STATUS_TONE[booking.status]} />}
        transparent
      />

      {/* ---------- spot mini-card ---------- */}
      <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: "timing", duration: 300 }}>
        <Card
          padded={false}
          onPress={() => navigation.navigate("SpotDetail", { id: booking.spotId })}
          style={{ overflow: "hidden" }}
        >
          {booking.spot.images[0] ? (
            <Image
              source={{ uri: booking.spot.images[0] }}
              style={{ width: "100%", height: 150, backgroundColor: colors.surfaceAlt }}
            />
          ) : (
            <SpotGraphic
              vehicleTypes={booking.spot.vehicleTypes}
              iconSize={40}
              style={{ width: "100%", height: 150 }}
            />
          )}
          <View style={{ padding: spacing.md }}>
            <Text style={{ color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.md }} numberOfLines={2}>
              {booking.spot.title}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.xs }}>
              <Ionicons name="location-outline" size={14} color={colors.textMuted} />
              <Text
                numberOfLines={1}
                style={{ marginLeft: 4, flex: 1, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}
              >
                {booking.spot.address}, {booking.spot.area}
              </Text>
            </View>
          </View>
        </Card>
      </MotiView>

      {/* ---------- booking info ---------- */}
      <Card style={{ marginTop: spacing.lg }}>
        <Text style={{ color: colors.text, fontFamily: typography.fonts.heading, fontSize: typography.sizes.md, marginBottom: spacing.md }}>
          Booking summary
        </Text>
        <InfoRow icon="pricetag-outline" label="Booking ID" value={booking.id.slice(0, 14).toUpperCase()} colors={colors} typography={typography} spacing={spacing} />
        <Divider style={{ marginVertical: spacing.md }} />
        <InfoRow icon="calendar-outline" label="Date" value={formatDate(booking.date, { withWeekday: true })} colors={colors} typography={typography} spacing={spacing} />
        <Divider style={{ marginVertical: spacing.md }} />
        <InfoRow icon="time-outline" label="Time" value={`${label12h(booking.startTime)} – ${label12h(booking.endTime)}`} colors={colors} typography={typography} spacing={spacing} />
        <Divider style={{ marginVertical: spacing.md }} />
        <InfoRow icon="hourglass-outline" label="Duration" value={`${booking.durationHours} ${booking.durationHours === 1 ? "hour" : "hours"}`} colors={colors} typography={typography} spacing={spacing} />
        <Divider style={{ marginVertical: spacing.md }} />
        <InfoRow icon="car-sport-outline" label="Vehicle" value={`${booking.vehicleType} · ${booking.vehicleNumber}`} colors={colors} typography={typography} spacing={spacing} />
        <Divider style={{ marginVertical: spacing.md }} />
        <View style={styles.rowBetween}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="cash-outline" size={18} color={colors.textMuted} />
            <Text style={{ marginLeft: spacing.sm, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}>
              Pay host directly
            </Text>
          </View>
          <Text style={{ color: colors.text, fontFamily: typography.fonts.headingBold, fontSize: typography.sizes.lg }}>
            {formatCurrency(booking.amount)}
          </Text>
        </View>
      </Card>

      {/* ---------- arrival OTP ---------- */}
      {booking.otp && booking.status !== "cancelled" && booking.status !== "completed" ? (
        <Card style={{ marginTop: spacing.lg }} elevated={false}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}>
                Show this OTP at the gate
              </Text>
              <Text
                style={{
                  marginTop: spacing.xs,
                  color: colors.primary,
                  fontFamily: typography.fonts.headingBold,
                  fontSize: typography.sizes.xxxl,
                  letterSpacing: 8,
                }}
              >
                {booking.otp}
              </Text>
            </View>
            <View style={[styles.otpIcon, { backgroundColor: colors.primaryLight, borderRadius: radius.md }]}>
              <Ionicons name="key" size={26} color={colors.primary} />
            </View>
          </View>
        </Card>
      ) : null}

      {/* ---------- host contact (unlocked) ---------- */}
      <Card style={{ marginTop: spacing.lg }}>
        <View style={styles.rowBetween}>
          <Text style={{ color: colors.text, fontFamily: typography.fonts.heading, fontSize: typography.sizes.md }}>
            Your host
          </Text>
          {contactUnlocked ? (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="lock-open" size={13} color={colors.success} />
              <Text style={{ marginLeft: 4, color: colors.success, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.xs }}>
                Unlocked
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="lock-closed" size={13} color={colors.textMuted} />
              <Text style={{ marginLeft: 4, color: colors.textMuted, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.xs }}>
                Locked
              </Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.md }}>
          <Avatar uri={host.avatar} name={host.name} size={48} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.md }}>
              {host.name}
            </Text>
            <Text style={{ marginTop: 2, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}>
              Responds {host.responseTime}
            </Text>
          </View>
          {host.verified ? <Ionicons name="shield-checkmark" size={20} color={colors.primary} /> : null}
        </View>

        {contactUnlocked ? (
          <Button
            label="Call host"
            variant="outline"
            onPress={callHost}
            iconLeft={<Ionicons name="call" size={16} color={colors.primary} />}
            style={{ marginTop: spacing.lg }}
            fullWidth
          />
        ) : (
          <View
            style={[
              styles.lockNote,
              { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, marginTop: spacing.md },
            ]}
          >
            <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
            <Text style={{ marginLeft: spacing.sm, flex: 1, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}>
              Contact details are hidden for cancelled bookings.
            </Text>
          </View>
        )}
      </Card>

      {/* ---------- location + directions ---------- */}
      <Card style={{ marginTop: spacing.lg }}>
        <Text style={{ color: colors.text, fontFamily: typography.fonts.heading, fontSize: typography.sizes.md, marginBottom: spacing.md }}>
          Location
        </Text>
        <LiveMap
          markers={[{ latitude: booking.spot.latitude, longitude: booking.spot.longitude, title: booking.spot.title, primary: true }]}
          height={150}
        />
        <Button
          label="Get directions"
          variant="secondary"
          onPress={getDirections}
          iconLeft={<Ionicons name="navigate" size={16} color={colors.white} />}
          style={{ marginTop: spacing.md }}
          fullWidth
        />
      </Card>

      {/* ---------- status timeline ---------- */}
      {timeline ? (
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.text, fontFamily: typography.fonts.heading, fontSize: typography.sizes.md, marginBottom: spacing.lg }}>
            Status timeline
          </Text>
          {timeline.steps.map((s, i) => {
            const reached = i <= timeline.currentIndex;
            const isLast = i === timeline.steps.length - 1;
            const isCancelStep = timeline.cancelled && i === timeline.currentIndex;
            const dotColor = isCancelStep
              ? colors.error
              : reached
              ? colors.primary
              : colors.border;
            return (
              <View key={s.key} style={styles.timelineRow}>
                <View style={styles.timelineGutter}>
                  <View
                    style={[
                      styles.timelineDot,
                      {
                        backgroundColor: reached ? dotColor : colors.surface,
                        borderColor: dotColor,
                      },
                    ]}
                  >
                    {reached ? (
                      <Ionicons
                        name={isCancelStep ? "close" : "checkmark"}
                        size={12}
                        color={colors.white}
                      />
                    ) : null}
                  </View>
                  {!isLast ? (
                    <View
                      style={[
                        styles.timelineLine,
                        { backgroundColor: i < timeline.currentIndex ? colors.primary : colors.border },
                      ]}
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1, paddingBottom: isLast ? 0 : spacing.lg }}>
                  <Text
                    style={{
                      color: reached ? colors.text : colors.textMuted,
                      fontFamily: typography.fonts.bodySemi,
                      fontSize: typography.sizes.sm,
                    }}
                  >
                    {s.title}
                  </Text>
                  <Text style={{ marginTop: 2, color: colors.textMuted, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}>
                    {s.desc}
                  </Text>
                </View>
              </View>
            );
          })}
        </Card>
      ) : null}

      {/* ---------- cancel action ---------- */}
      {canCancel ? (
        <Button
          label="Cancel booking"
          variant="danger"
          onPress={() => {
            haptics.warning();
            setConfirmVisible(true);
          }}
          loading={cancelling}
          style={{ marginTop: spacing.xl }}
          fullWidth
          iconLeft={!cancelling ? <Ionicons name="close-circle-outline" size={18} color={colors.white} /> : undefined}
        />
      ) : null}

      <View style={{ height: spacing.xl }} />

      <CancelReasonSheet
        visible={confirmVisible}
        title="Cancel this booking?"
        subtitle="Your parking spot will be released. Please pick a reason so we can help."
        confirmLabel="Yes, cancel"
        keepLabel="Keep booking"
        loading={cancelling}
        onConfirm={doCancel}
        onClose={() => !cancelling && setConfirmVisible(false)}
      />
    </Screen>
  );
}

function InfoRow({
  icon,
  label,
  value,
  colors,
  typography,
  spacing,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  colors: any;
  typography: any;
  spacing: any;
}) {
  return (
    <View style={styles.rowBetween}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Ionicons name={icon} size={18} color={colors.textMuted} />
        <Text style={{ marginLeft: spacing.sm, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}>
          {label}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{ maxWidth: "58%", color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm, textTransform: label === "Vehicle" ? "capitalize" : "none" }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  otpIcon: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  lockNote: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  timelineRow: {
    flexDirection: "row",
  },
  timelineGutter: {
    width: 24,
    alignItems: "center",
    marginRight: 12,
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 2,
    minHeight: 24,
  },
});
