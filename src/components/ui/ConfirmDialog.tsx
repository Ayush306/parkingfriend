import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ViewStyle,
} from "react-native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/theme/ThemeContext";

export type ConfirmTone = "primary" | "danger" | "warning";

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  onConfirm,
  onCancel,
}) => {
  const { colors, spacing, typography, radius, shadows } = useTheme();

  const toneColor =
    tone === "danger"
      ? colors.error
      : tone === "warning"
      ? colors.warning
      : colors.primary;

  const toneIcon =
    tone === "danger"
      ? "alert-circle"
      : tone === "warning"
      ? "warning"
      : "help-circle";

  const handleConfirm = () => {
    Haptics.impactAsync(
      tone === "danger"
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light
    ).catch(() => {});
    onConfirm();
  };

  const handleCancel = () => {
    Haptics.selectionAsync().catch(() => {});
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <Pressable
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        onPress={handleCancel}
        accessibilityLabel="Dismiss dialog"
      >
        <Pressable
          onPress={() => {}}
          style={styles.centerWrap}
          accessible={false}
        >
          <MotiView
            from={{ opacity: 0, scale: 0.9, translateY: 8 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 220 }}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                padding: spacing.xl,
                ...shadows.xl,
              },
            ]}
            accessibilityLabel={title}
          >
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: toneColor + "1A",
                  borderRadius: radius.pill,
                },
              ]}
            >
              <Ionicons name={toneIcon as any} size={30} color={toneColor} />
            </View>

            <Text
              style={{
                marginTop: spacing.lg,
                color: colors.text,
                fontFamily: typography.fonts.heading,
                fontSize: typography.sizes.xl,
                textAlign: "center",
              }}
            >
              {title}
            </Text>

            {message ? (
              <Text
                style={{
                  marginTop: spacing.sm,
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.body,
                  fontSize: typography.sizes.md,
                  textAlign: "center",
                  lineHeight: 22,
                }}
              >
                {message}
              </Text>
            ) : null}

            <View style={[styles.actions, { marginTop: spacing.xl }]}>
              <Pressable
                onPress={handleCancel}
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
                style={({ pressed }) => [
                  styles.btn,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderRadius: radius.md,
                    paddingVertical: spacing.md,
                    marginRight: spacing.sm,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
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
                  {cancelLabel}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleConfirm}
                accessibilityRole="button"
                accessibilityLabel={confirmLabel}
                style={({ pressed }) => [
                  styles.btn,
                  {
                    backgroundColor: toneColor,
                    borderRadius: radius.md,
                    paddingVertical: spacing.md,
                    marginLeft: spacing.sm,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.white,
                    fontFamily: typography.fonts.bodySemi,
                    fontSize: typography.sizes.md,
                  }}
                >
                  {confirmLabel}
                </Text>
              </Pressable>
            </View>
          </MotiView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerWrap: {
    width: "100%",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
  },
  iconWrap: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    flexDirection: "row",
    width: "100%",
  },
  btn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
