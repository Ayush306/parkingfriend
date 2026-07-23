import React from "react";
import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";

import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { useTheme } from "@/theme/ThemeContext";
import { useToast } from "@/components/ui/Toast";
import { haptics } from "@/utils/haptics";
import { formatDate } from "@/utils/format";
import type { HostRequest } from "@/models/types";

/**
 * ONE card for an incoming booking request — used by both My Space's inline
 * tabs and the Booking requests screen, so the host sees the exact same thing
 * everywhere. Covers the full lifecycle:
 *
 *   pending    → Accept / Decline / Message
 *   accepted   → Call + Message + CANCEL BOOKING (any time before it ends)
 *   completed  → Message only (call removed once the parking is over)
 *   declined   → "You declined" + Message only
 *   cancelled  → who cancelled (you vs the driver) + Message only
 */

function vehicleIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type === "bike") return "bicycle-outline";
  if (type === "bicycle") return "bicycle-outline";
  if (type === "suv") return "car-outline";
  return "car-sport-outline";
}

/** Local YYYY-MM-DD for "has this parking's last day passed?" checks. */
function todayYmd(): string {
  const now = new Date();
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export interface HostRequestCardProps {
  request: HostRequest;
  index: number;
  busy: boolean;
  onRespond: (accept: boolean) => void;
  onMessage: () => void;
  /** Host cancels an ACCEPTED booking (opens the reason sheet). */
  onCancel: () => void;
}

export function HostRequestCard({
  request,
  index,
  busy,
  onRespond,
  onMessage,
  onCancel,
}: HostRequestCardProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const toast = useToast();

  const isPending = request.status === "pending";
  const isAccepted = request.status === "accepted";
  // Multi-day parkings stay "live" until their LAST day has passed.
  const stillLive = String(request.endDate ?? request.date) >= todayYmd();
  const isCompleted = isAccepted && !stillLive;

  // Standard: once a parking is over (or was declined/cancelled), the call
  // option goes away — only Message remains, on both sides.
  const showCall = isAccepted && stillLive;
  const canMessage = !!request.bookingId;

  const badge: { label: string; tone: "warning" | "success" | "error" | "neutral" } =
    isPending
      ? { label: "Pending", tone: "warning" }
      : isCompleted
        ? { label: "Completed", tone: "neutral" }
        : isAccepted
          ? { label: "Accepted", tone: "success" }
          : request.status === "cancelled"
            ? { label: "Cancelled", tone: "neutral" }
            : { label: "Declined", tone: "error" };

  const callRequester = () => {
    if (!request.requesterPhone) return;
    haptics.light();
    Linking.openURL(`tel:${request.requesterPhone.replace(/\s+/g, "")}`).catch(
      () => toast.show("Couldn't open the dialer on this device.", "error")
    );
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 14 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 340, delay: Math.min(index, 6) * 60 }}
      style={{ marginBottom: spacing.md }}
    >
      <Card elevated>
        {/* Header row */}
        <View style={styles.topRow}>
          <Avatar
            uri={request.requesterAvatar}
            name={request.requesterName}
            size={48}
          />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                numberOfLines={1}
                style={{
                  flexShrink: 1,
                  color: colors.text,
                  fontFamily: typography.fonts.bodySemi,
                  fontSize: typography.sizes.md,
                }}
              >
                {request.requesterName}
              </Text>
              {/* The driver's rating so the host knows who they're letting in */}
              <View style={styles.driverRating}>
                <Ionicons name="star" size={12} color={colors.star} />
                <Text
                  style={{
                    marginLeft: 2,
                    color: colors.textSecondary,
                    fontFamily: typography.fonts.bodyMedium,
                    fontSize: typography.sizes.xs,
                  }}
                >
                  {(request.requesterRatingCount ?? 0) > 0
                    ? (request.requesterRating ?? 0).toFixed(1)
                    : "New"}
                </Text>
              </View>
            </View>
            <Text
              numberOfLines={1}
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.sm,
                marginTop: 1,
              }}
            >
              {request.spotTitle}
            </Text>
          </View>
          <Badge label={badge.label} tone={badge.tone} />
        </View>

        <Divider style={{ marginVertical: spacing.md }} />

        {/* Detail chips */}
        <View style={styles.detailRow}>
          <View style={styles.detail}>
            <Ionicons
              name={vehicleIcon(request.vehicleType)}
              size={16}
              color={colors.primary}
            />
            <Text
              style={[styles.detailText, { color: colors.textSecondary, fontFamily: typography.fonts.bodyMedium, fontSize: typography.sizes.sm }]}
            >
              {request.vehicleType.toUpperCase()}
            </Text>
          </View>
          <View style={styles.detail}>
            <Ionicons name="calendar-outline" size={16} color={colors.secondary} />
            <Text
              style={[styles.detailText, { color: colors.textSecondary, fontFamily: typography.fonts.bodyMedium, fontSize: typography.sizes.sm }]}
            >
              {formatDate(request.date, { withWeekday: true })}
            </Text>
          </View>
        </View>
        <View style={[styles.detail, { marginTop: spacing.sm }]}>
          <Ionicons name="time-outline" size={16} color={colors.accent} />
          <Text
            style={[styles.detailText, { color: colors.textSecondary, fontFamily: typography.fonts.bodyMedium, fontSize: typography.sizes.sm }]}
          >
            {request.time}
          </Text>
        </View>

        {/* Message — the one contact option that's ALWAYS there */}
        {canMessage ? (
          <Pressable
            onPress={onMessage}
            accessibilityRole="button"
            accessibilityLabel={`Message ${request.requesterName}`}
            style={({ pressed }) => [
              styles.chatBtn,
              {
                borderColor: colors.primary,
                borderRadius: radius.md,
                marginTop: spacing.lg,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
            <Text
              style={{
                marginLeft: 7,
                color: colors.primary,
                fontFamily: typography.fonts.bodySemi,
                fontSize: typography.sizes.sm,
              }}
            >
              Message {request.requesterName.split(" ")[0]}
            </Text>
          </Pressable>
        ) : null}

        {/* Actions / resolved state */}
        {isPending ? (
          <View style={[styles.actions, { marginTop: spacing.md }]}>
            <View style={{ flex: 1 }}>
              <Button
                label="Decline"
                variant="outline"
                size="md"
                fullWidth
                disabled={busy}
                onPress={() => onRespond(false)}
              />
            </View>
            <View style={{ width: spacing.md }} />
            <View style={{ flex: 1 }}>
              <Button
                label="Accept"
                variant="gradient"
                size="md"
                fullWidth
                loading={busy}
                onPress={() => onRespond(true)}
              />
            </View>
          </View>
        ) : showCall ? (
          <MotiView
            from={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "timing", duration: 300 }}
          >
            <Pressable
              onPress={callRequester}
              disabled={!request.requesterPhone}
              accessibilityRole="button"
              accessibilityLabel={
                request.requesterPhone
                  ? `Call ${request.requesterName} at ${request.requesterPhone}`
                  : "Contact not available"
              }
              style={({ pressed }) => [
                styles.contactBox,
                {
                  backgroundColor: colors.primaryLight,
                  borderRadius: radius.md,
                  marginTop: spacing.md,
                  padding: spacing.md,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.contactIcon,
                  { backgroundColor: colors.primary, borderRadius: radius.pill },
                ]}
              >
                <Ionicons name="call" size={16} color={colors.white} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text
                  style={{
                    color: colors.primaryDark,
                    fontFamily: typography.fonts.bodySemi,
                    fontSize: typography.sizes.sm,
                  }}
                >
                  {request.requesterPhone ? "Tap to call" : "Contact shared"}
                </Text>
                <Text
                  style={{
                    color: colors.text,
                    fontFamily: typography.fonts.bodyMedium,
                    fontSize: typography.sizes.md,
                    marginTop: 1,
                  }}
                >
                  {request.requesterPhone || "Not available"}
                </Text>
              </View>
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={colors.success}
              />
            </Pressable>
            {/* The host's way out, right until the parking's last day. */}
            <Pressable
              onPress={onCancel}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Cancel this booking"
              hitSlop={6}
              style={({ pressed }) => [styles.cancelLink, { opacity: pressed || busy ? 0.5 : 1 }]}
            >
              <Ionicons name="close-circle-outline" size={15} color={colors.error} />
              <Text
                style={{
                  marginLeft: 5,
                  color: colors.error,
                  fontFamily: typography.fonts.bodySemi,
                  fontSize: typography.sizes.xs,
                }}
              >
                Cancel booking
              </Text>
            </Pressable>
          </MotiView>
        ) : (
          <View style={[styles.resolvedRow, { marginTop: spacing.md }]}>
            <Ionicons
              name={isCompleted ? "checkmark-done-outline" : "close-circle-outline"}
              size={16}
              color={colors.textMuted}
            />
            <Text
              style={{
                marginLeft: spacing.xs + 2,
                flex: 1,
                color: colors.textMuted,
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.sm,
              }}
            >
              {isCompleted
                ? "Parking completed."
                : request.status === "cancelled"
                  ? request.cancelledBy === "host"
                    ? "You cancelled this booking."
                    : "The driver cancelled this booking — the slot is free again."
                  : "You declined this request"}
            </Text>
          </View>
        )}
      </Card>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  driverRating: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 6,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detail: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailText: {
    marginLeft: 6,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  contactBox: {
    flexDirection: "row",
    alignItems: "center",
  },
  contactIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  resolvedRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  chatBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderWidth: 1.5,
  },
  cancelLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 10,
    paddingVertical: 4,
  },
});
