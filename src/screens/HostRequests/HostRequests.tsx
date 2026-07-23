import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TabSwipe } from "@/components/ui/TabSwipe";
import { SkeletonList } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { CancelReasonSheet, HOST_CANCEL_REASONS } from "@/components/ui/CancelReasonSheet";
import { NoBookings } from "@/components/illustrations/NoBookings";
import { HostRequestCard } from "@/components/host/HostRequestCard";
import { useTheme } from "@/theme/ThemeContext";
import { useAsync } from "@/hooks/useAsync";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useToast } from "@/components/ui/Toast";
import { haptics } from "@/utils/haptics";
import { hostService } from "@/services/hostService";
import type { HostRequest } from "@/models/types";

/**
 * Booking requests — the standalone inbox (notification taps land here).
 * The exact same cards + tabs also live inline on the My Space page.
 */

const FILTERS = ["Pending", "Accepted", "All"] as const;

export default function HostRequests() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const toast = useToast();
  const { spacing } = useTheme();

  const { data, loading, error, refetch, refetchSilent, setData } = useAsync<HostRequest[]>(
    () => hostService.getRequests(),
    []
  );
  // Stay live: refresh on focus + a gentle 30s poll while open, so a driver
  // cancelling (or a new request) shows up without leaving the screen.
  useLiveRefresh(refetchSilent, 30000);

  const [refreshing, setRefreshing] = useState(false);
  // A notification about a cancelled/accepted request can land directly on
  // the right filter (e.g. "Driver cancelled" opens All, where it's visible).
  const initialFilter: string = (route.params as any)?.filter ?? FILTERS[0];
  const [filter, setFilter] = useState<string>(
    (FILTERS as readonly string[]).includes(initialFilter) ? initialFilter : FILTERS[0]
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<HostRequest | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // A notification tap can land while this screen is ALREADY open (navigate
  // just updates params, no remount) — react to every tap, not just the first.
  useEffect(() => {
    const wanted = (route.params as any)?.filter;
    if (wanted && (FILTERS as readonly string[]).includes(wanted)) {
      setFilter(wanted);
    }
  }, [route.params]);

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
    if (filter === "Accepted") {
      return list.filter((r) => r.status === "accepted");
    }
    return list;
  }, [data, filter]);

  const pendingCount = useMemo(
    () => (data ?? []).filter((r) => r.status === "pending").length,
    [data]
  );

  // Finger swipe left/right walks the tabs (clamped at the ends). The haptic
  // fires only when the tab REALLY changes — a buzz with no movement at the
  // first/last tab would read as "swiping is broken".
  const shiftTab = useCallback(
    (dir: 1 | -1) => {
      const idx = (FILTERS as readonly string[]).indexOf(filter);
      const next = FILTERS[Math.min(FILTERS.length - 1, Math.max(0, idx + dir))];
      if (next !== filter) {
        haptics.light();
        setFilter(next);
      }
    },
    [filter]
  );

  const handleRespond = async (request: HostRequest, accept: boolean) => {
    if (busyId) return;
    setBusyId(request.id);
    try {
      const updated = await hostService.respond(request.id, accept);
      // MERGE, don't replace: /respond returns the bare request without the
      // GET-only enriched fields (endDate, requester rating). Replacing would
      // drop endDate → a mid-stay multi-day accept would render "Completed".
      setData((prev) =>
        (prev ?? []).map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
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
      // The server may have just told us the request changed under us (e.g.
      // the driver withdrew) — re-fetch so the card reflects reality.
      refetchSilent();
    } finally {
      setBusyId(null);
    }
  };

  // Host cancels a booking they had ALREADY accepted — reason first, then
  // the driver's phone is notified immediately and the slot frees up.
  const doCancelAccepted = async (reason: string) => {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    try {
      const updated = await hostService.cancelAccepted(cancelTarget.id, reason);
      // Merge (not replace) so the enriched endDate/rating fields survive.
      setData((prev) =>
        (prev ?? []).map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
      );
      setCancelTarget(null);
      haptics.success();
      toast.show("Booking cancelled — the driver has been notified.", "success");
    } catch (e: any) {
      haptics.error();
      toast.show(e?.message ?? "Couldn't cancel this booking.", "error");
      refetchSilent();
    } finally {
      setCancelling(false);
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

      {/* flexGrow so the swipe area covers the empty space below short lists */}
      <TabSwipe onNext={() => shiftTab(1)} onPrev={() => shiftTab(-1)} style={{ flexGrow: 1 }}>
        {/* Keep the tabs mounted during a visible refetch (data present) so a
            pull-to-refresh doesn't blink the whole tab bar out and reflow. */}
        {(data || !loading) && !error ? (
          <View style={{ marginBottom: spacing.lg }}>
            <SegmentedControl
              options={[...FILTERS]}
              value={filter}
              onChange={setFilter}
            />
          </View>
        ) : null}

        {loading && !data ? (
          <SkeletonList count={4} card />
        ) : error && !data ? (
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
              <HostRequestCard
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
                onCancel={() => {
                  haptics.warning();
                  setCancelTarget(req);
                }}
              />
            ))}
          </View>
        )}
      </TabSwipe>

      <CancelReasonSheet
        visible={!!cancelTarget}
        title="Cancel this booking?"
        subtitle={`${cancelTarget?.requesterName ?? "The driver"} will be told immediately. Please pick a reason.`}
        reasons={HOST_CANCEL_REASONS}
        confirmLabel="Yes, cancel booking"
        keepLabel="Keep the booking"
        loading={cancelling}
        onConfirm={doCancelAccepted}
        onClose={() => !cancelling && setCancelTarget(null)}
      />
    </Screen>
  );
}
