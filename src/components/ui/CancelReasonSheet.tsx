import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/ThemeContext";
import { haptics } from "@/utils/haptics";

/** The special "Other" option that reveals a free-text field. */
const OTHER = "Other";

/** Reasons a driver might cancel a parking request/booking. */
export const DRIVER_CANCEL_REASONS = [
  "My plans changed",
  "I found another spot",
  "The host is taking too long",
  "It's too far from where I need to be",
  "The price is too high",
  "I booked it by mistake",
];

export interface CancelReasonSheetProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  reasons?: string[];
  confirmLabel?: string;
  keepLabel?: string;
  loading?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/**
 * A bottom sheet that asks WHY the user is cancelling. Shows a set of one-tap
 * preset reasons plus an "Other" option with a free-text box. A reason is
 * always required — the confirm button stays disabled until one is chosen (and
 * "Other" needs some text). Built on a plain Modal so it works on web too.
 */
export const CancelReasonSheet: React.FC<CancelReasonSheetProps> = ({
  visible,
  title = "Why are you cancelling?",
  subtitle = "This helps us keep ParkingFriend reliable. Pick a reason to continue.",
  reasons = DRIVER_CANCEL_REASONS,
  confirmLabel = "Cancel booking",
  keepLabel = "Keep it",
  loading = false,
  onConfirm,
  onClose,
}) => {
  const { colors, spacing, typography, radius, shadows } = useTheme();

  const [selected, setSelected] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");

  // Fresh start every time the sheet opens.
  useEffect(() => {
    if (visible) {
      setSelected(null);
      setOtherText("");
    }
  }, [visible]);

  const options = useMemo(() => [...reasons, OTHER], [reasons]);

  const finalReason =
    selected === OTHER ? otherText.trim() : selected ?? "";
  const canConfirm = finalReason.length > 0 && !loading;

  const pick = (reason: string) => {
    haptics.selection();
    setSelected(reason);
  };

  const handleConfirm = () => {
    if (!canConfirm) {
      haptics.warning();
      return;
    }
    haptics.warning();
    onConfirm(finalReason);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
              {/* grabber */}
              <View style={[styles.grabber, { backgroundColor: colors.border }]} />

              <Text
                style={{
                  color: colors.text,
                  fontFamily: typography.fonts.headingBold,
                  fontSize: typography.sizes.xl,
                  marginTop: spacing.sm,
                }}
              >
                {title}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.body,
                  fontSize: typography.sizes.sm,
                  marginTop: spacing.xs,
                  lineHeight: 20,
                }}
              >
                {subtitle}
              </Text>

              <ScrollView
                style={{ marginTop: spacing.lg, maxHeight: 340 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {options.map((reason) => {
                  const active = selected === reason;
                  return (
                    <Pressable
                      key={reason}
                      onPress={() => pick(reason)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={reason}
                      style={({ pressed }) => [
                        styles.row,
                        {
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? colors.primaryLight : colors.surface,
                          borderRadius: radius.md,
                          marginBottom: spacing.sm,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.radio,
                          { borderColor: active ? colors.primary : colors.border },
                        ]}
                      >
                        {active ? (
                          <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />
                        ) : null}
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          marginLeft: spacing.md,
                          color: colors.text,
                          fontFamily: active
                            ? typography.fonts.bodySemi
                            : typography.fonts.body,
                          fontSize: typography.sizes.md,
                        }}
                      >
                        {reason === OTHER ? "Other reason" : reason}
                      </Text>
                    </Pressable>
                  );
                })}

                {/* free-text box appears only for "Other" */}
                {selected === OTHER ? (
                  <TextInput
                    value={otherText}
                    onChangeText={setOtherText}
                    placeholder="Tell us in a few words…"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    autoFocus
                    maxLength={200}
                    style={[
                      styles.textArea,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceAlt,
                        borderRadius: radius.md,
                        color: colors.text,
                        fontFamily: typography.fonts.body,
                        fontSize: typography.sizes.md,
                      },
                    ]}
                  />
                ) : null}
              </ScrollView>

              {/* actions */}
              <View style={[styles.actions, { marginTop: spacing.lg }]}>
                <Pressable
                  onPress={loading ? undefined : onClose}
                  accessibilityRole="button"
                  accessibilityLabel={keepLabel}
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
                  <Text
                    style={{
                      color: colors.text,
                      fontFamily: typography.fonts.bodySemi,
                      fontSize: typography.sizes.md,
                    }}
                  >
                    {keepLabel}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleConfirm}
                  disabled={!canConfirm}
                  accessibilityRole="button"
                  accessibilityLabel={confirmLabel}
                  style={({ pressed }) => [
                    styles.btn,
                    {
                      backgroundColor: canConfirm ? colors.error : colors.surfaceAlt,
                      borderRadius: radius.md,
                      marginLeft: spacing.sm,
                      opacity: pressed && canConfirm ? 0.9 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: canConfirm ? colors.white : colors.textMuted,
                      fontFamily: typography.fonts.bodySemi,
                      fontSize: typography.sizes.md,
                    }}
                  >
                    {loading ? "Cancelling…" : confirmLabel}
                  </Text>
                </Pressable>
              </View>

              <View style={{ height: spacing.xl }} />
            </MotiView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetWrap: {
    width: "100%",
  },
  sheet: {
    width: "100%",
    paddingTop: 10,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  textArea: {
    minHeight: 76,
    borderWidth: 1,
    padding: 12,
    textAlignVertical: "top",
  },
  actions: {
    flexDirection: "row",
  },
  btn: {
    flex: 1,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
  },
});
