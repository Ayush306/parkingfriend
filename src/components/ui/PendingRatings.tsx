import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";

import { useTheme } from "@/theme/ThemeContext";
import { useAsync } from "@/hooks/useAsync";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { ratingService } from "@/services/ratingService";
import { Avatar } from "@/components/ui/Avatar";
import { RatingSheet } from "@/components/ui/RatingSheet";
import { useToast } from "@/components/ui/Toast";
import { haptics } from "@/utils/haptics";
import type { PendingRating } from "@/models/types";

/**
 * Shows the completed parkings the user still needs to rate for one role, and
 * lets them rate right there. Renders nothing when there's nothing to rate.
 *   role "driver" → "Rate your host"  (used on My bookings)
 *   role "host"   → "Rate your guest" (used on My Space)
 */
export function PendingRatings({ role }: { role: "driver" | "host" }) {
  const { colors, spacing, typography, radius, shadows } = useTheme();
  const toast = useToast();

  const { data, refetch, refetchSilent } = useAsync<PendingRating[]>(
    () => ratingService.getPending(),
    []
  );
  useLiveRefresh(refetchSilent, 0);

  const [target, setTarget] = useState<PendingRating | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const items = (data ?? []).filter((p) => p.role === role);

  const submit = useCallback(
    async (stars: number, comment: string) => {
      if (!target) return;
      setSubmitting(true);
      try {
        await ratingService.submit(target.bookingId, stars, comment);
        setTarget(null);
        haptics.success();
        toast.show("Thanks for your rating!", "success");
        refetch();
      } catch (e: any) {
        haptics.error();
        toast.show(e?.message ?? "Couldn't submit your rating.", "error");
      } finally {
        setSubmitting(false);
      }
    },
    [target, toast, refetch]
  );

  if (items.length === 0) return null;

  const heading = role === "driver" ? "Rate your host" : "Rate your guest";

  return (
    <View style={{ marginTop: spacing.xl }}>
      <View style={styles.headRow}>
        <Ionicons name="star" size={16} color={colors.star} />
        <Text
          style={{
            marginLeft: 6,
            color: colors.text,
            fontFamily: typography.fonts.heading,
            fontSize: typography.sizes.md,
          }}
        >
          {heading}
          {items.length > 1 ? ` · ${items.length}` : ""}
        </Text>
      </View>

      {items.slice(0, 4).map((p, i) => (
        <MotiView
          key={p.bookingId}
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 260, delay: i * 50 }}
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.lg,
              marginTop: spacing.sm,
              ...shadows.sm,
            },
          ]}
        >
          <Avatar uri={p.counterparty.avatar ?? undefined} name={p.counterparty.name} size={40} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
              {p.counterparty.name}
            </Text>
            <Text numberOfLines={1} style={{ color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}>
              {role === "driver" ? "How was parking at " : "How was your guest at "}
              {p.spotTitle}?
            </Text>
          </View>
          <Pressable
            onPress={() => {
              haptics.light();
              setTarget(p);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${p.counterparty.name}`}
            style={({ pressed }) => [
              styles.rateBtn,
              { backgroundColor: colors.primary, borderRadius: radius.md, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="star-outline" size={14} color={colors.white} />
            <Text style={{ marginLeft: 5, color: colors.white, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.sm }}>
              Rate
            </Text>
          </Pressable>
        </MotiView>
      ))}

      <RatingSheet
        visible={!!target}
        title={role === "driver" ? "Rate your host" : "Rate your guest"}
        subtitle={target ? `${target.counterparty.name} · ${target.spotTitle}` : undefined}
        personName={target?.counterparty.name}
        personAvatar={target?.counterparty.avatar ?? undefined}
        loading={submitting}
        onSubmit={submit}
        onClose={() => !submitting && setTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rateBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
});
