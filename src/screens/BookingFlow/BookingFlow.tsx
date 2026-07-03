import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Image, ScrollView } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { MotiView } from "moti";
import { Ionicons, Feather } from "@expo/vector-icons";

import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { Badge } from "@/components/ui/Badge";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Divider } from "@/components/ui/Divider";
import { Loader } from "@/components/ui/Loader";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

import { useTheme } from "@/theme/ThemeContext";
import { useAsync } from "@/hooks/useAsync";
import { spotService } from "@/services/spotService";
import { bookingService } from "@/services/bookingService";
import type { ParkingSpot } from "@/models/types";
import { formatCurrency, formatDate } from "@/utils/format";
import { haptics } from "@/utils/haptics";

/** Vehicle type label -> stored key. */
const VEHICLE_OPTIONS = ["Car", "Bike", "SUV"] as const;
const VEHICLE_KEY: Record<string, "car" | "bike" | "suv"> = {
  Car: "car",
  Bike: "bike",
  SUV: "suv",
};

const STEP_LABELS = ["When", "Vehicle", "Review"];

/** Builds a list of the next 7 calendar days as Date objects. */
function nextSevenDays(): Date[] {
  const days: Date[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    days.push(d);
  }
  return days;
}

/** Half-hourly time slots between an availability window. */
function buildTimeSlots(from: string, to: string): string[] {
  const parse = (s: string) => {
    const [h, m] = s.split(":").map((n) => parseInt(n, 10));
    return h * 60 + (isNaN(m) ? 0 : m);
  };
  const start = parse(from || "06:00");
  const end = parse(to || "23:00");
  const slots: string[] = [];
  for (let mins = start; mins <= end; mins += 60) {
    const h = Math.floor(mins / 60);
    const mm = mins % 60;
    slots.push(`${h.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`);
  }
  return slots;
}

/** Renders a "HH:mm" 24h string as friendly 12h label. */
function label12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const meridiem = h >= 12 ? "PM" : "AM";
  let hour = h % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${(m || 0).toString().padStart(2, "0")} ${meridiem}`;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function BookingFlow() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const spotId: string = (route.params as any)?.spotId ?? "s1";
  const { colors, spacing, typography, radius, shadows } = useTheme();
  const toast = useToast();

  const {
    data: spot,
    loading,
    error,
    refetch,
  } = useAsync<ParkingSpot | null>(() => spotService.getById(spotId), [spotId]);

  const [step, setStep] = useState(0);

  // Step 1 — date + time
  const days = useMemo(() => nextSevenDays(), []);
  const [selectedDay, setSelectedDay] = useState<Date>(days[0]);
  const timeSlots = useMemo(
    () => buildTimeSlots(spot?.availableFrom ?? "06:00", spot?.availableTo ?? "23:00"),
    [spot?.availableFrom, spot?.availableTo]
  );
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);

  // Step 2 — vehicle
  const [vehicleLabel, setVehicleLabel] = useState<string>("Car");
  const [vehicleNumber, setVehicleNumber] = useState<string>("");
  const [vehicleError, setVehicleError] = useState<string | undefined>(undefined);

  // Step 3 — submission
  const [submitting, setSubmitting] = useState(false);

  const durationHours = useMemo(() => {
    if (!startTime || !endTime) return 0;
    const [sh, sm] = startTime.split(":").map((n) => parseInt(n, 10));
    const [eh, em] = endTime.split(":").map((n) => parseInt(n, 10));
    const diff = eh * 60 + em - (sh * 60 + sm);
    return Math.max(0, Math.round((diff / 60) * 10) / 10);
  }, [startTime, endTime]);

  const gross = useMemo(() => {
    if (!spot) return 0;
    if (spot.isFree) return 0;
    // Charge per-day when the booking spans 8h+ and per-day is cheaper.
    const hourly = Math.round(durationHours * spot.pricePerHour);
    if (durationHours >= 8 && spot.pricePerDay < hourly) {
      return spot.pricePerDay;
    }
    return hourly;
  }, [spot, durationHours]);

  const total = gross;

  const dateISO = useMemo(() => {
    const y = selectedDay.getFullYear();
    const m = (selectedDay.getMonth() + 1).toString().padStart(2, "0");
    const d = selectedDay.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [selectedDay]);

  // ---- validation gates per step ----
  const step1Valid = !!startTime && !!endTime && durationHours > 0;
  const step2Valid = /^[A-Za-z0-9\s-]{4,12}$/.test(vehicleNumber.trim());

  const goNext = () => {
    if (step === 0 && !step1Valid) {
      haptics.warning();
      if (!startTime || !endTime) {
        toast.show("Pick a start and end time to continue.", "warning");
      } else {
        toast.show("End time must be after start time.", "warning");
      }
      return;
    }
    if (step === 1) {
      if (!step2Valid) {
        haptics.warning();
        setVehicleError("Enter a valid vehicle number (e.g. HR26 AB 1234).");
        return;
      }
      setVehicleError(undefined);
    }
    haptics.light();
    setStep((s) => Math.min(2, s + 1));
  };

  const goBack = () => {
    if (step === 0) {
      navigation.goBack();
      return;
    }
    haptics.light();
    setStep((s) => Math.max(0, s - 1));
  };

  const handleStartSelect = (slot: string) => {
    setStartTime(slot);
    // Clear an end time that is no longer after start.
    if (endTime && endTime <= slot) setEndTime(null);
  };

  const confirmBooking = async () => {
    if (!spot) return;
    haptics.medium();
    setSubmitting(true);
    try {
      const booking = await bookingService.create({
        spotId: spot.id,
        spot,
        vehicleType: VEHICLE_KEY[vehicleLabel],
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        date: dateISO,
        startTime: startTime!,
        endTime: endTime!,
        durationHours,
        amount: total,
      });
      navigation.replace("BookingConfirmation", { bookingId: booking.id });
    } catch (e: any) {
      haptics.error();
      toast.show(e?.message ?? "Couldn't confirm your booking.", "error");
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------- render
  if (loading) {
    return (
      <Screen>
        <Header title="Book a spot" showBack onBack={() => navigation.goBack()} />
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
          <SkeletonCard />
          <View style={{ height: spacing.lg }} />
          <SkeletonCard />
        </View>
      </Screen>
    );
  }

  if (error || !spot) {
    return (
      <Screen>
        <Header title="Book a spot" showBack onBack={() => navigation.goBack()} />
        <ErrorState
          title="Couldn't load this spot"
          subtitle={error ?? "This parking spot is no longer available."}
          onRetry={refetch}
          style={{ flex: 1 }}
        />
      </Screen>
    );
  }

  const availableEndSlots = startTime
    ? timeSlots.filter((s) => s > startTime)
    : timeSlots;

  return (
    <Screen padded={false}>
      <Header
        title="Book a spot"
        subtitle={spot.title}
        showBack
        onBack={goBack}
      />

      <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.md }}>
        <StepIndicator steps={3} current={step} labels={STEP_LABELS} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ================= STEP 1 — DATE & TIME ================= */}
        {step === 0 ? (
          <MotiView
            key="step1"
            from={{ opacity: 0, translateX: 24 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: "timing", duration: 280 }}
          >
            <Text style={[styles.sectionLabel, { color: colors.text, fontFamily: typography.fonts.heading, fontSize: typography.sizes.lg }]}>
              Select a date
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: spacing.xs, gap: spacing.sm }}
            >
              {days.map((d) => {
                const active = d.toDateString() === selectedDay.toDateString();
                return (
                  <Pressable
                    key={d.toISOString()}
                    onPress={() => {
                      haptics.selection();
                      setSelectedDay(d);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={formatDate(d, { withWeekday: true })}
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderColor: active ? colors.primary : colors.border,
                        borderRadius: radius.lg,
                        ...(active ? shadows.sm : {}),
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontFamily: typography.fonts.bodyMedium,
                        fontSize: typography.sizes.xs,
                        color: active ? colors.white : colors.textSecondary,
                      }}
                    >
                      {DAY_NAMES[d.getDay()]}
                    </Text>
                    <Text
                      style={{
                        fontFamily: typography.fonts.headingBold,
                        fontSize: typography.sizes.xl,
                        color: active ? colors.white : colors.text,
                        marginVertical: 2,
                      }}
                    >
                      {d.getDate()}
                    </Text>
                    <Text
                      style={{
                        fontFamily: typography.fonts.body,
                        fontSize: typography.sizes.xs,
                        color: active ? colors.white : colors.textMuted,
                      }}
                    >
                      {MONTHS[d.getMonth()]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View
              style={[
                styles.windowNote,
                { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, marginTop: spacing.md },
              ]}
            >
              <Feather name="clock" size={15} color={colors.textSecondary} />
              <Text
                style={{
                  marginLeft: spacing.sm,
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.body,
                  fontSize: typography.sizes.sm,
                }}
              >
                Available {label12h(spot.availableFrom)} – {label12h(spot.availableTo)}
              </Text>
            </View>

            <Text style={[styles.sectionLabel, { marginTop: spacing.xl, color: colors.text, fontFamily: typography.fonts.heading, fontSize: typography.sizes.lg }]}>
              Start time
            </Text>
            <View style={styles.slotWrap}>
              {timeSlots.map((slot) => (
                <Chip
                  key={`start-${slot}`}
                  label={label12h(slot)}
                  selected={startTime === slot}
                  onPress={() => handleStartSelect(slot)}
                />
              ))}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: spacing.xl, color: colors.text, fontFamily: typography.fonts.heading, fontSize: typography.sizes.lg }]}>
              End time
            </Text>
            {!startTime ? (
              <Text
                style={{
                  color: colors.textMuted,
                  fontFamily: typography.fonts.body,
                  fontSize: typography.sizes.sm,
                  marginTop: spacing.xs,
                }}
              >
                Pick a start time first.
              </Text>
            ) : (
              <View style={styles.slotWrap}>
                {availableEndSlots.map((slot) => (
                  <Chip
                    key={`end-${slot}`}
                    label={label12h(slot)}
                    selected={endTime === slot}
                    onPress={() => setEndTime(slot)}
                  />
                ))}
              </View>
            )}

            {durationHours > 0 ? (
              <View
                style={[
                  styles.summaryRow,
                  { backgroundColor: colors.primaryLight, borderRadius: radius.md, marginTop: spacing.xl },
                ]}
              >
                <Ionicons name="hourglass-outline" size={18} color={colors.primary} />
                <Text
                  style={{
                    marginLeft: spacing.sm,
                    color: colors.primaryDark,
                    fontFamily: typography.fonts.bodySemi,
                    fontSize: typography.sizes.sm,
                  }}
                >
                  {durationHours} {durationHours === 1 ? "hour" : "hours"} · approx {formatCurrency(gross)}
                </Text>
              </View>
            ) : null}
          </MotiView>
        ) : null}

        {/* ================= STEP 2 — VEHICLE ================= */}
        {step === 1 ? (
          <MotiView
            key="step2"
            from={{ opacity: 0, translateX: 24 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: "timing", duration: 280 }}
          >
            <Text style={[styles.sectionLabel, { color: colors.text, fontFamily: typography.fonts.heading, fontSize: typography.sizes.lg }]}>
              Vehicle type
            </Text>
            <SegmentedControl
              options={[...VEHICLE_OPTIONS]}
              value={vehicleLabel}
              onChange={setVehicleLabel}
              style={{ marginTop: spacing.sm }}
            />

            {!spot.vehicleTypes.includes(VEHICLE_KEY[vehicleLabel]) ? (
              <View
                style={[
                  styles.warnRow,
                  { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, marginTop: spacing.md },
                ]}
              >
                <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
                <Text
                  style={{
                    marginLeft: spacing.sm,
                    flex: 1,
                    color: colors.textSecondary,
                    fontFamily: typography.fonts.body,
                    fontSize: typography.sizes.sm,
                  }}
                >
                  This host usually accepts {spot.vehicleTypes.join(", ")}. Do confirm on arrival.
                </Text>
              </View>
            ) : null}

            <View style={{ height: spacing.xl }} />

            <Input
              label="Vehicle number"
              value={vehicleNumber}
              onChangeText={(t) => {
                setVehicleNumber(t.toUpperCase());
                if (vehicleError) setVehicleError(undefined);
              }}
              placeholder="HR26 AB 1234"
              iconLeft={<Ionicons name="car-sport-outline" size={20} color={colors.textMuted} />}
              maxLength={12}
              error={vehicleError}
            />

            <Card style={{ marginTop: spacing.xl }} elevated={false}>
              <View style={styles.rowBetween}>
                <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}>
                  Date
                </Text>
                <Text style={{ color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
                  {formatDate(selectedDay, { withWeekday: true })}
                </Text>
              </View>
              <Divider style={{ marginVertical: spacing.md }} />
              <View style={styles.rowBetween}>
                <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}>
                  Time
                </Text>
                <Text style={{ color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
                  {startTime ? label12h(startTime) : "--"} – {endTime ? label12h(endTime) : "--"}
                </Text>
              </View>
            </Card>
          </MotiView>
        ) : null}

        {/* ================= STEP 3 — REVIEW ================= */}
        {step === 2 ? (
          <MotiView
            key="step3"
            from={{ opacity: 0, translateX: 24 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: "timing", duration: 280 }}
          >
            {/* spot mini card */}
            <Card padded={false} style={{ overflow: "hidden" }}>
              <View style={{ flexDirection: "row", padding: spacing.md }}>
                <Image
                  source={{ uri: spot.images[0] }}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: radius.md,
                    backgroundColor: colors.surfaceAlt,
                  }}
                />
                <View style={{ flex: 1, marginLeft: spacing.md, justifyContent: "center" }}>
                  <Text
                    numberOfLines={2}
                    style={{ color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.md }}
                  >
                    {spot.title}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.xs }}>
                    <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                    <Text
                      numberOfLines={1}
                      style={{ marginLeft: 3, flex: 1, color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}
                    >
                      {spot.area} · near {spot.nearStation}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>

            {/* booking details */}
            <Card style={{ marginTop: spacing.lg }}>
              <ReviewRow label="Date" value={formatDate(selectedDay, { withWeekday: true })} colors={colors} typography={typography} spacing={spacing} />
              <Divider style={{ marginVertical: spacing.md }} />
              <ReviewRow
                label="Time"
                value={`${label12h(startTime!)} – ${label12h(endTime!)}`}
                colors={colors}
                typography={typography}
                spacing={spacing}
              />
              <Divider style={{ marginVertical: spacing.md }} />
              <ReviewRow label="Duration" value={`${durationHours} ${durationHours === 1 ? "hour" : "hours"}`} colors={colors} typography={typography} spacing={spacing} />
              <Divider style={{ marginVertical: spacing.md }} />
              <View style={styles.rowBetween}>
                <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}>
                  Vehicle
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Badge label={vehicleLabel} tone="neutral" size="sm" />
                  <Text style={{ marginLeft: spacing.sm, color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
                    {vehicleNumber.trim().toUpperCase()}
                  </Text>
                </View>
              </View>
            </Card>

            {/* price — settled directly with the host, no in-app payment */}
            <Card style={{ marginTop: spacing.xl }}>
              <PriceRow label={`Parking (${durationHours}h)`} value={formatCurrency(gross)} colors={colors} typography={typography} spacing={spacing} />
              <Divider style={{ marginVertical: spacing.md }} />
              <View style={styles.rowBetween}>
                <Text style={{ color: colors.text, fontFamily: typography.fonts.heading, fontSize: typography.sizes.lg }}>
                  Pay the host
                </Text>
                <Text style={{ color: colors.text, fontFamily: typography.fonts.headingBold, fontSize: typography.sizes.xl }}>
                  {formatCurrency(total)}
                </Text>
              </View>
              <View
                style={[
                  styles.warnRow,
                  { backgroundColor: colors.primaryLight, borderRadius: radius.md, marginTop: spacing.md },
                ]}
              >
                <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                <Text
                  style={{
                    marginLeft: spacing.sm,
                    flex: 1,
                    color: colors.primaryDark,
                    fontFamily: typography.fonts.body,
                    fontSize: typography.sizes.sm,
                  }}
                >
                  Settle directly with the host on arrival — Parkmitter doesn't process payments.
                </Text>
              </View>
            </Card>
          </MotiView>
        ) : null}
      </ScrollView>

      {/* ================= FOOTER CONTROLS ================= */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.md,
            paddingBottom: spacing.xl,
          },
        ]}
      >
        <View style={styles.footerRow}>
          <Button
            label={step === 0 ? "Cancel" : "Back"}
            variant="outline"
            onPress={goBack}
            style={{ flex: 1, marginRight: spacing.md }}
          />
          {step < 2 ? (
            <Button
              label="Continue"
              variant="gradient"
              onPress={goNext}
              disabled={step === 0 ? !step1Valid : false}
              iconRight={<Ionicons name="arrow-forward" size={18} color={colors.white} />}
              style={{ flex: 1.4 }}
            />
          ) : (
            <Button
              label="Confirm booking"
              variant="gradient"
              onPress={confirmBooking}
              loading={submitting}
              style={{ flex: 2 }}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

// ------------------------------------------------------------------- helpers
function ReviewRow({
  label,
  value,
  colors,
  typography,
  spacing,
}: {
  label: string;
  value: string;
  colors: any;
  typography: any;
  spacing: any;
}) {
  return (
    <View style={styles.rowBetween}>
      <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}>
        {label}
      </Text>
      <Text style={{ color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
        {value}
      </Text>
    </View>
  );
}

function PriceRow({
  label,
  value,
  colors,
  typography,
}: {
  label: string;
  value: string;
  colors: any;
  typography: any;
  spacing: any;
}) {
  return (
    <View style={styles.rowBetween}>
      <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm }}>
        {label}
      </Text>
      <Text style={{ color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sectionLabel: {
    marginBottom: 4,
  },
  dayChip: {
    width: 64,
    alignItems: "center",
    paddingVertical: 10,
    borderWidth: 1.5,
  },
  windowNote: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  slotWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  warnRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  appliedCoupon: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1.5,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});
