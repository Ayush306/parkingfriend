import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useTheme } from "@/theme/ThemeContext";
import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SuccessCheck } from "@/components/illustrations/SuccessCheck";
import { simulate } from "@/services/mockClient";
import { haptics } from "@/utils/haptics";

const CATEGORIES = [
  "App experience",
  "Booking",
  "Payments",
  "Hosting",
  "Suggestion",
  "Bug report",
];

const RATING_LABELS: Record<number, string> = {
  1: "Very poor",
  2: "Needs work",
  3: "It's okay",
  4: "Good",
  5: "Love it!",
};

export default function Feedback() {
  const navigation = useNavigation<any>();
  const { colors, spacing, typography, radius } = useTheme();

  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const canSubmit = rating > 0 && !!category && message.trim().length >= 3;

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (!canSubmit) {
      setError(
        rating === 0
          ? "Please tap a star to rate us"
          : !category
          ? "Pick a category that fits best"
          : "Tell us a little more (min. 3 characters)"
      );
      haptics.warning();
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      await simulate({ ok: true }, { ms: 800 });
      haptics.success();
      setSubmitted(true);
    } catch {
      setSubmitting(false);
      haptics.error();
      setError("Couldn't send your feedback. Please try again.");
    }
  }, [submitting, canSubmit, rating, category]);

  // ---- Success state ----
  if (submitted) {
    return (
      <Screen padded>
        <Header showBack onBack={() => navigation.goBack()} />
        <View style={styles.successWrap}>
          <MotiView
            from={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 13, stiffness: 160 }}
          >
            <SuccessCheck size={168} color={colors.primary} />
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 420, delay: 160 }}
            style={{ alignItems: "center" }}
          >
            <Text
              style={{
                marginTop: spacing.xl,
                fontFamily: typography.fonts.headingBold,
                fontSize: typography.sizes.xxl,
                color: colors.text,
                textAlign: "center",
              }}
            >
              Thank you!
            </Text>
            <Text
              style={{
                marginTop: spacing.sm,
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.md,
                color: colors.textSecondary,
                textAlign: "center",
                lineHeight: 22,
                paddingHorizontal: spacing.lg,
              }}
            >
              Your feedback helps us make ParkingFriend a better parking friend for
              everyone. We read every note.
            </Text>

            <View
              style={[
                styles.ratingRecap,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: radius.pill,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  marginTop: spacing.xl,
                },
              ]}
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <Ionicons
                  key={i}
                  name={i <= rating ? "star" : "star-outline"}
                  size={18}
                  color={colors.star}
                  style={{ marginHorizontal: 2 }}
                />
              ))}
            </View>
          </MotiView>
        </View>

        <View style={{ paddingBottom: spacing.xl }}>
          <Button
            label="Done"
            variant="gradient"
            size="lg"
            fullWidth
            onPress={() => navigation.goBack()}
          />
        </View>
      </Screen>
    );
  }

  // ---- Form state ----
  return (
    <Screen scroll padded>
      <Header title="Feedback" showBack onBack={() => navigation.goBack()} />

      {/* Keyboard avoidance is handled by the parent <Screen scroll>. */}
      <View>
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 380 }}
        >
          <Text
            style={{
              fontFamily: typography.fonts.heading,
              fontSize: typography.sizes.xl,
              color: colors.text,
              marginTop: spacing.sm,
            }}
          >
            How's your experience?
          </Text>
          <Text
            style={{
              marginTop: spacing.xs,
              fontFamily: typography.fonts.body,
              fontSize: typography.sizes.md,
              color: colors.textSecondary,
            }}
          >
            Your honest feedback shapes what we build next.
          </Text>
        </MotiView>

        {/* Rating selector */}
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 400, delay: 80 }}
          style={[
            styles.ratingCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: spacing.lg,
              marginTop: spacing.xl,
            },
          ]}
        >
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((i) => {
              const active = i <= rating;
              return (
                <Pressable
                  key={i}
                  onPress={() => {
                    haptics.selection();
                    setRating(i);
                    setError(undefined);
                  }}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${i} star${i > 1 ? "s" : ""}`}
                  style={styles.starBtn}
                >
                  <MotiView
                    animate={{ scale: active ? 1.12 : 1 }}
                    transition={{ type: "spring", damping: 12, stiffness: 220 }}
                  >
                    <Ionicons
                      name={active ? "star" : "star-outline"}
                      size={38}
                      color={active ? colors.star : colors.textMuted}
                    />
                  </MotiView>
                </Pressable>
              );
            })}
          </View>
          <Text
            style={{
              marginTop: spacing.md,
              fontFamily: typography.fonts.bodySemi,
              fontSize: typography.sizes.md,
              color: rating > 0 ? colors.primary : colors.textMuted,
            }}
          >
            {rating > 0 ? RATING_LABELS[rating] : "Tap to rate"}
          </Text>
        </MotiView>

        {/* Categories */}
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 400, delay: 140 }}
          style={{ marginTop: spacing.xl }}
        >
          <Text
            style={{
              fontFamily: typography.fonts.bodySemi,
              fontSize: typography.sizes.md,
              color: colors.text,
              marginBottom: spacing.md,
            }}
          >
            What's it about?
          </Text>
          <View style={styles.chipWrap}>
            {CATEGORIES.map((cat) => (
              <View key={cat} style={{ marginRight: spacing.sm, marginBottom: spacing.sm }}>
                <Chip
                  label={cat}
                  selected={category === cat}
                  onPress={() => {
                    setCategory(cat);
                    setError(undefined);
                  }}
                />
              </View>
            ))}
          </View>
        </MotiView>

        {/* Message */}
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 400, delay: 200 }}
          style={{ marginTop: spacing.lg }}
        >
          <Input
            label="Tell us more"
            value={message}
            onChangeText={(t) => {
              setMessage(t);
              if (error) setError(undefined);
            }}
            placeholder="What did you love, or what could be better?"
            multiline
            maxLength={500}
            error={error}
          />
          <Text
            style={{
              alignSelf: "flex-end",
              marginTop: spacing.xs,
              fontFamily: typography.fonts.body,
              fontSize: typography.sizes.xs,
              color: colors.textMuted,
            }}
          >
            {message.length}/500
          </Text>
        </MotiView>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Button
          label="Submit feedback"
          variant="gradient"
          size="lg"
          fullWidth
          loading={submitting}
          onPress={handleSubmit}
          iconLeft={
            !submitting ? (
              <Ionicons name="paper-plane-outline" size={18} color={colors.white} />
            ) : undefined
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ratingCard: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  starBtn: {
    paddingHorizontal: 6,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingRecap: {
    flexDirection: "row",
    alignItems: "center",
  },
});
