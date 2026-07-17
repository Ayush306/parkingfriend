import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SkeletonList } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { NoBookings } from "@/components/illustrations/NoBookings";
import { useTheme } from "@/theme/ThemeContext";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/components/ui/Toast";
import { haptics } from "@/utils/haptics";
import { formatDate } from "@/utils/format";
import { hostService } from "@/services/hostService";
import type { HostRequest } from "@/models/types";

const FILTERS = ["Pending", "All"] as const;

function vehicleIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type === "bike") return "bicycle-outline";
  if (type === "bicycle") return "bicycle-outline";
  if (type === "suv") return "car-outline";
  return "car-sport-outline";
}

function statusTone(
  status: HostRequest["status"]
): "warning" | "success" | "error" {
  if (status === "accepted") return "success";
  if (status === "declined") return "error";
  return "warning";
}

function statusLabel(status: HostRequest["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

interface RequestCardProps {
  request: HostRequest;
  index: number;
  busy: boolean;
  onRespond: (accept: boolean) => void;
  onMessage: () => void;
}

function RequestCard({ request, index, busy, onRespond, onMessage }: RequestCardProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const toast = useToast();
  const isPending = request.status === "pending";
  const isAccepted = request.status === "accepted";
  // Chat is there for the whole parking lifespan — pending AND accepted.
  const canChat = !!request.bookingId && (isPending || isAccepted);

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
      transition={{ type: "timing", duration: 340, delay: index * 60 }}
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
            <Text
              numberOfLines={1}
              style={{
                color: colors.text,
                fontFamily: typography.fonts.bodySemi,
                fontSize: typography.sizes.md,
              }}
            >
              {request.requesterName}
            </Text>
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
          <Badge label={statusLabel(request.status)} tone={statusTone(request.status)} />
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

        {/* Chat with the driver — available before AND after accepting */}
        {canChat ? (
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
        ) : isAccepted ? (
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
                  marginTop: spacing.lg,
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
          </MotiView>
        ) : (
          <View style={[styles.declinedRow, { marginTop: spacing.md }]}>
            <Ionicons
              name="close-circle-outline"
              size={16}
              color={colors.textMuted}
            />
            <Text
              style={{
                marginLeft: spacing.xs + 2,
                color: colors.textMuted,
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.sm,
              }}
            >
              You declined this request
            </Text>
          </View>
        )}
      </Card>
    </MotiView>
  );
}

export default function HostRequests() {
  const navigation = useNavigation<any>();
  const toast = useToast();
  const { spacing } = useTheme();

  const { data, loading, error, refetch, setData } = useAsync<HostRequest[]>(
    () => hostService.getRequests(),
    []
  );
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>(FILTERS[0]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    refetch();
    // small guard so the spinner is visible even on fast resolves
    setTimeout(() => setRefreshing(false), 800);
  };

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (filter === "Pending") {
      return list.filter((r) => r.status === "pending");
    }
    return list;
  }, [data, filter]);

  const pendingCount = useMemo(
    () => (data ?? []).filter((r) => r.status === "pending").length,
    [data]
  );

  const handleRespond = async (request: HostRequest, accept: boolean) => {
    if (busyId) return;
    setBusyId(request.id);
    try {
      const updated = await hostService.respond(request.id, accept);
      setData((prev) =>
        (prev ?? []).map((r) => (r.id === updated.id ? updated : r))
      );
      if (accept) {
        haptics.success();
        toast.show("Request accepted — contact shared.", "success");
      } else {
        haptics.warning();
        toast.show("Request declined.", "info");
      }
    } catch (e: any) {
      haptics.error();
      toast.show(e?.message ?? "Couldn't update the request.", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen scroll padded refreshing={refreshing} onRefresh={onRefresh}>
      <Header
        showBack
        title="Booking requests"
        subtitle={
          pendingCount > 0
            ? `${pendingCount} pending ${pendingCount === 1 ? "request" : "requests"}`
            : "You're all caught up"
        }
        onBack={() => navigation.goBack()}
      />

      {!loading && !error ? (
        <View style={{ marginBottom: spacing.lg }}>
          <SegmentedControl
            options={[...FILTERS]}
            value={filter}
            onChange={setFilter}
          />
        </View>
      ) : null}

      {loading ? (
        <SkeletonList count={4} card />
      ) : error ? (
        <ErrorState
          title="Couldn't load requests"
          subtitle={error}
          onRetry={refetch}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          illustration={NoBookings}
          title={
            filter === "Pending" ? "No pending requests" : "No requests yet"
          }
          subtitle={
            filter === "Pending"
              ? "New booking requests from drivers will appear here for you to accept or decline."
              : "When drivers request one of your spots, you'll see their requests here."
          }
          actionLabel="List a space"
          onAction={() => navigation.navigate("ListSpace")}
        />
      ) : (
        <View>
          {filtered.map((req, i) => (
            <RequestCard
              key={req.id}
              request={req}
              index={i}
              busy={busyId === req.id}
              onRespond={(accept) => handleRespond(req, accept)}
              onMessage={() => {
                haptics.light();
                navigation.navigate("Chat", {
                  bookingId: req.bookingId,
                  spotTitle: req.spotTitle,
                });
              }}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "center",
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
  declinedRow: {
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
});
