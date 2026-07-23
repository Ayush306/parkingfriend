import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
} from "react-native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/ThemeContext";
import { Avatar } from "@/components/ui/Avatar";
import { KeyboardAvoider } from "@/components/ui/KeyboardAvoider";
import { haptics } from "@/utils/haptics";

const WORDS = ["", "Poor", "Okay", "Good", "Great", "Excellent"];

export interface RatingSheetProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  personName?: string;
  personAvatar?: string | null;
  loading?: boolean;
  onSubmit: (stars: number, comment: string) => void;
  onClose: () => void;
}

/**
 * A bottom sheet for rating the other side of a completed parking: tap 1–5
 * stars, optionally add a comment, submit. A star is required before the
 * button enables. Built on a plain Modal so it also works on web.
 */
export const RatingSheet: React.FC<RatingSheetProps> = ({
  visible,
  title = "Leave a rating",
  subtitle,
  personName,
  personAvatar,
  loading = false,
  onSubmit,
  onClose,
}) => {
  const { colors, spacing, typography, radius, shadows } = useTheme();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (visible) {
      setStars(0);
      setComment("");
    }
  }, [visible]);

  const canSubmit = stars >= 1 && !loading;

  const pick = (n: number) => {
    haptics.selection();
    setStars(n);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoider style={styles.flex}>
        <Pressable
          style={[styles.overlay, { backgroundColor: colors.overlay }]}
          onPress={loading ? undefined : onClose}
          accessibilityLabel="Dismiss"
        >
          <Pressable onPress={() => {}} accessible={false} style={styles.sheetWrap}>
            <MotiView
              from={{ opacity: 0, translateY: 40 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 240 }}
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: radius.xl,
                  borderTopRightRadius: radius.xl,
                  paddingHorizontal: spacing.xl,
                  ...shadows.xl,
                },
              ]}
            >
              <View style={[styles.grabber, { backgroundColor: colors.border }]} />

              {personName ? (
                <View style={styles.person}>
                  <Avatar uri={personAvatar ?? undefined} name={personName} size={56} />
                  <Text
                    style={{
                      marginTop: spacing.sm,
                      color: colors.text,
                      fontFamily: typography.fonts.headingBold,
                      fontSize: typography.sizes.lg,
                    }}
                  >
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text
                      style={{
                        marginTop: 2,
                        color: colors.textSecondary,
                        fontFamily: typography.fonts.body,
                        fontSize: typography.sizes.sm,
                        textAlign: "center",
                      }}
                    >
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text
                  style={{
                    color: colors.text,
                    fontFamily: typography.fonts.headingBold,
                    fontSize: typography.sizes.xl,
                    marginTop: spacing.sm,
                    textAlign: "center",
                  }}
                >
                  {title}
                </Text>
              )}

              {/* Stars */}
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => pick(n)}
                    accessibilityRole="button"
                    accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`}
                    hitSlop={4}
                    style={({ pressed }) => [styles.star, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Ionicons
                      name={n <= stars ? "star" : "star-outline"}
                      size={40}
                      color={n <= stars ? colors.star : colors.textMuted}
                    />
                  </Pressable>
                ))}
              </View>
              <Text
                style={{
                  textAlign: "center",
                  minHeight: 20,
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.bodySemi,
                  fontSize: typography.sizes.sm,
                }}
              >
                {WORDS[stars] || "Tap a star"}
              </Text>

              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Add a comment (optional)…"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={300}
                style={[
                  styles.textArea,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceAlt,
                    borderRadius: radius.md,
                    color: colors.text,
                    fontFamily: typography.fonts.body,
                    fontSize: typography.sizes.md,
                    marginTop: spacing.md,
                  },
                ]}
              />

              <View style={[styles.actions, { marginTop: spacing.lg }]}>
                <Pressable
                  onPress={loading ? undefined : onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Not now"
                  style={({ pressed }) => [
                    styles.btn,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderRadius: radius.md,
                      marginRight: spacing.sm,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.md }}>
                    Not now
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => (canSubmit ? onSubmit(stars, comment.trim()) : haptics.warning())}
                  disabled={!canSubmit}
                  accessibilityRole="button"
                  accessibilityLabel="Submit rating"
                  style={({ pressed }) => [
                    styles.btn,
                    {
                      backgroundColor: canSubmit ? colors.primary : colors.surfaceAlt,
                      borderRadius: radius.md,
                      marginLeft: spacing.sm,
                      opacity: pressed && canSubmit ? 0.9 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: canSubmit ? colors.white : colors.textMuted,
                      fontFamily: typography.fonts.bodySemi,
                      fontSize: typography.sizes.md,
                    }}
                  >
                    {loading ? "Submitting…" : "Submit"}
                  </Text>
                </Pressable>
              </View>

              <View style={{ height: spacing.xl }} />
            </MotiView>
          </Pressable>
        </Pressable>
      </KeyboardAvoider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheetWrap: { width: "100%" },
  sheet: { width: "100%", paddingTop: 10 },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 8 },
  person: { alignItems: "center", marginTop: 4 },
  stars: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
    marginBottom: 6,
  },
  star: { paddingHorizontal: 6 },
  textArea: {
    minHeight: 70,
    borderWidth: 1,
    padding: 12,
    textAlignVertical: "top",
  },
  actions: { flexDirection: "row" },
  btn: {
    flex: 1,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
  },
});
