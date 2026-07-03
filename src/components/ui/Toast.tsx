import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { View, Text, StyleSheet } from "react-native";
import { MotiView, AnimatePresence } from "moti";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/theme/ThemeContext";

export type ToastTone = "success" | "error" | "info" | "warning";

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICONS: Record<ToastTone, keyof typeof Ionicons.glyphMap> = {
  success: "checkmark-circle",
  error: "close-circle",
  info: "information-circle",
  warning: "warning",
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const show = useCallback((message: string, tone: ToastTone = "info") => {
    if (timer.current) clearTimeout(timer.current);
    counter.current += 1;
    setToast({ id: counter.current, message, tone });
    Haptics.notificationAsync(
      tone === "error"
        ? Haptics.NotificationFeedbackType.Error
        : tone === "success"
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning
    ).catch(() => {});
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <ToastHost toast={toast} />
    </ToastContext.Provider>
  );
};

const ToastHost: React.FC<{ toast: ToastState | null }> = ({ toast }) => {
  const { colors, spacing, typography, radius, shadows } = useTheme();
  const insets = useSafeAreaInsets();

  const toneColor = (tone: ToastTone) =>
    tone === "success"
      ? colors.success
      : tone === "error"
      ? colors.error
      : tone === "warning"
      ? colors.warning
      : colors.info;

  return (
    <View
      pointerEvents="none"
      style={[styles.host, { top: insets.top + spacing.sm }]}
    >
      <AnimatePresence>
        {toast ? (
          <MotiView
            key={toast.id}
            from={{ opacity: 0, translateY: -24, scale: 0.96 }}
            animate={{ opacity: 1, translateY: 0, scale: 1 }}
            exit={{ opacity: 0, translateY: -24, scale: 0.96 }}
            transition={{ type: "spring", damping: 18, stiffness: 220 }}
            style={[
              styles.toast,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.pill,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                borderColor: colors.border,
                ...shadows.lg,
              },
            ]}
            accessibilityLiveRegion="polite"
            accessibilityLabel={toast.message}
          >
            <View
              style={[
                styles.iconDot,
                { backgroundColor: toneColor(toast.tone) + "1A" },
              ]}
            >
              <Ionicons
                name={ICONS[toast.tone]}
                size={18}
                color={toneColor(toast.tone)}
              />
            </View>
            <Text
              numberOfLines={2}
              style={{
                flex: 1,
                marginLeft: spacing.sm,
                color: colors.text,
                fontFamily: typography.fonts.bodyMedium,
                fontSize: typography.sizes.sm,
              }}
            >
              {toast.message}
            </Text>
          </MotiView>
        ) : null}
      </AnimatePresence>
    </View>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
};

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
    paddingHorizontal: 16,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: 480,
    width: "100%",
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
});
