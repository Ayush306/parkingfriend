import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  ScrollView,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { MotiView } from "moti";
import { Ionicons, Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Divider } from "@/components/ui/Divider";
import { Loader } from "@/components/ui/Loader";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";
import { SuccessCheck } from "@/components/illustrations/SuccessCheck";

import { useTheme } from "@/theme/ThemeContext";
import { useAsync } from "@/hooks/useAsync";
import { bookingService } from "@/services/bookingService";
import type { Booking } from "@/models/types";
import { formatCurrency, formatDate } from "@/utils/format";
import { haptics } from "@/utils/haptics";

/** Renders a "HH:mm" 24h string as friendly 12h label. */
function label12h(hhmm?: string): string {
  if (!hhmm) return "--";
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const meridiem = h >= 12 ? "PM" : "AM";
  let hour = h % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${(m || 0).toString().padStart(2, "0")} ${meridiem}`;
}

export default function BookingConfirmation() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const bookingId: string = (route.params as any)?.bookingId ?? "";
  const { colors, spacing, typography, radius } = useTheme();
  const toast = useToast();

  const { data: booking, loading, error, refetch } = useAsync<Booking | null>(
    () => bookingService.getById(bookingId),
    [bookingId]
  );

  // Celebrate on mount.
  useEffect(() => {
    if (booking) haptics.success();
  }, [booking]);

  const goHome = () => {
    haptics.light();
    navigation.reset({
      index: 0,
      routes: [{ name: "Main" }],
    });
  };

  const viewBooking = () => {
    haptics.light();
    navigation.replace("BookingDetail", { id: booking?.id });
  };

  const callHost = () => {
    if (!booking) return;
    // Hosts don't carry a phone in the model; use a demo Gurugram number.
    const number = "+919811024567";
    haptics.light();
    Linking.openURL(`tel:${number}`).catch(() =>
      toast.show("Couldn't open the dialer on this device.", "error")
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]}>
        <Loader fullscreen label="Confirming your booking..." />
      </SafeAreaView>
    );
  }

  if (error || !booking) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]}>
        <ErrorState
          title="Booking not found"
          subtitle={error ?? "We couldn't load your booking details."}
          onRetry={refetch}
          style={{ flex: 1 }}
        />
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}>
          <Button label="Back to home" variant="outline" fullWidth onPress={goHome} />
        </View>
      </SafeAreaView>
    );
  }

  const host = booking.spot.host;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: spacing.xl,
          paddingBottom: spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- success hero ---------- */}
        <View style={styles.hero}>
          <MotiView
            from={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 12, stiffness: 160, delay: 80 }}
          >
            <SuccessCheck size={148} color={colors.success} />
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 320, delay: 260 }}
          >
            <Text
              style={{
                marginTop: spacing.md,
                color: colors.text,
                fontFamily: typography.fonts.headingBold,
                fontSize: typography.sizes.xxl,
                textAlign: "center",
              }}
            >
              Booking confirmed!
            </Text>
            <Text
              style={{
                marginTop: spacing.xs,
                color: colors.textSecondary,
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.md,
                textAlign: "center",
              }}
            >
              Your spot is reserved. Pay the host directly on arrival.
            </Text>
          </MotiView>
        </View>

        {/* ---------- booking summary ---------- */}
        <MotiView
          from={{ opacity: 0, translateY: 14 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 340, delay: 380 }}
        >
          <Card>
            <View style={styles.rowBetween}>
              <Text
                numberOfLines={2}
                style={{ flex: 1, color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.md, marginRight: spacing.sm }}
              >
                {booking.spot.title}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={{ marginLeft: 4, color: colors.success, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
                  Confirmed
                </Text>
              </View>
            </View>

            <Divider style={{ marginVertical: spacing.md }} />

            <SummaryRow icon="calendar-outline" label="Date" value={formatDate(booking.date, { withWeekday: true })} colors={colors} typography={typography} spacing={spacing} />
            <View style={{ height: spacing.md }} />
            <SummaryRow icon="time-outline" label="Time" value={`${label12h(booking.startTime)} – ${label12h(booking.endTime)}`} colors={colors} typography={typography} spacing={spacing} />
            <View style={{ height: spacing.md }} />
            <SummaryRow icon="car-sport-outline" label="Vehicle" value={`${booking.vehicleNumber}`} colors={colors} typography={typography} spacing={spacing} />
            <View style={{ height: spacing.md }} />
            <SummaryRow icon="cash-outline" label="Pay host" value={`${formatCurrency(booking.amount)} · directly`} colors={colors} typography={typography} spacing={spacing} />

            {booking.otp ? (
              <>
                <Divider style={{ marginVertical: spacing.md }} />
                <View style={[styles.otpBox, { backgroundColor: colors.primaryLight, borderRadius: radius.md }]}>
                  <View>
                    <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}>
                      Arrival OTP
                    </Text>
                    <Text style={{ color: colors.primaryDark, fontFamily: typography.fonts.headingBold, fontSize: typography.sizes.xxl, letterSpacing: 6 }}>
                      {booking.otp}
                    </Text>
                  </View>
                  <Ionicons name="key-outline" size={30} color={colors.primary} />
                </View>
              </>
            ) : null}
          </Card>
        </MotiView>

        {/* ---------- unlocked host contact ---------- */}
        <MotiView
          from={{ opacity: 0, translateY: 14 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 340, delay: 480 }}
        >
          <Card style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ position: "relative" }}>
                <Avatar uri={host.avatar} name={host.name} size={52} />
                <View
                  style={[
                    styles.unlockBadge,
                    { backgroundColor: colors.success, borderColor: colors.surface },
                  ]}
                >
                  <Ionicons name="lock-open" size={11} color={colors.white} />
                </View>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={{ color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.md }}>
                  {host.name}
                </Text>
                <Text style={{ marginTop: 2, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}>
                  Host · responds {host.responseTime}
                </Text>
              </View>
              {host.verified ? (
                <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
              ) : null}
            </View>

            <View style={{ flexDirection: "row", marginTop: spacing.lg }}>
              <Button
                label="Call host"
                variant="primary"
                onPress={callHost}
                iconLeft={<Ionicons name="call" size={16} color={colors.white} />}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Pressable
                onPress={() => {
                  haptics.light();
                  toast.show("Chat opens once you reach the spot.", "info");
                }}
                accessibilityRole="button"
                accessibilityLabel="Message host"
                style={({ pressed }) => [
                  styles.msgBtn,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderRadius: radius.md,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="message-circle" size={20} color={colors.text} />
              </Pressable>
            </View>
          </Card>
        </MotiView>

        <View style={{ height: spacing.xxl }} />

        {/* ---------- actions ---------- */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: "timing", duration: 320, delay: 560 }}
        >
          <Button label="View booking" variant="gradient" size="lg" fullWidth onPress={viewBooking} />
          <View style={{ height: spacing.md }} />
          <Button label="Back to home" variant="ghost" fullWidth onPress={goHome} />
        </MotiView>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({
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
    <View style={styles.summaryRow}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <Text
        style={{
          width: 74,
          marginLeft: spacing.sm,
          color: colors.textSecondary,
          fontFamily: typography.fonts.body,
          fontSize: typography.sizes.sm,
        }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          textAlign: "right",
          color: colors.text,
          fontFamily: typography.fonts.bodySemi,
          fontSize: typography.sizes.sm,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 24,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  otpBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  unlockBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  msgBtn: {
    width: 50,
    alignItems: "center",
    justifyContent: "center",
  },
});
