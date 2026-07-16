import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/ThemeContext";
import { haptics } from "@/utils/haptics";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const pad = (n: number) => String(n).padStart(2, "0");
/** Build a YYYY-MM-DD string from local calendar parts (m1 is 1–12). */
const toYmd = (y: number, m1: number, d: number) => `${y}-${pad(m1)}-${pad(d)}`;

/** Today as YYYY-MM-DD in the device's local timezone. */
function todayYmd(): string {
  const d = new Date();
  return toYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function parseYmd(s?: string | null): { y: number; m1: number; d: number } | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { y: Number(m[1]), m1: Number(m[2]), d: Number(m[3]) };
}

export interface CalendarModalProps {
  visible: boolean;
  title?: string;
  /** Currently selected day (YYYY-MM-DD), highlighted when in view. */
  value?: string | null;
  /** Earliest selectable day (YYYY-MM-DD). Days before it are disabled. Defaults to today. */
  minDate?: string | null;
  onSelect: (date: string) => void;
  onClose: () => void;
}

/**
 * A compact, dependency-free month calendar in a centered modal. Handles month
 * navigation, disables days before `minDate` (today by default), and returns
 * the tapped day as a YYYY-MM-DD string. Works on web and native.
 */
export const CalendarModal: React.FC<CalendarModalProps> = ({
  visible,
  title = "Pick a date",
  value,
  minDate,
  onSelect,
  onClose,
}) => {
  const { colors, spacing, typography, radius, shadows } = useTheme();

  const floor = minDate || todayYmd();
  const floorParts = parseYmd(floor)!;
  const floorIndex = floorParts.y * 12 + (floorParts.m1 - 1);

  // Which month is on screen. Start on the selected day's month, else the floor.
  const initial = parseYmd(value) || floorParts;
  const [view, setView] = useState({ y: initial.y, m1: initial.m1 });

  useEffect(() => {
    if (visible) {
      const start = parseYmd(value) || parseYmd(minDate || todayYmd())!;
      setView({ y: start.y, m1: start.m1 });
    }
  }, [visible, value, minDate]);

  const viewIndex = view.y * 12 + (view.m1 - 1);
  const canGoPrev = viewIndex > floorIndex;

  const cells = useMemo(() => {
    const firstWeekday = new Date(view.y, view.m1 - 1, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(view.y, view.m1, 0).getDate();
    const out: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(d);
    return out;
  }, [view]);

  const step = (delta: number) => {
    haptics.selection();
    setView((prev) => {
      const idx = prev.y * 12 + (prev.m1 - 1) + delta;
      return { y: Math.floor(idx / 12), m1: (idx % 12) + 1 };
    });
  };

  const choose = (day: number) => {
    haptics.selection();
    onSelect(toYmd(view.y, view.m1, day));
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        onPress={onClose}
        accessibilityLabel="Dismiss calendar"
      >
        <Pressable onPress={() => {}} accessible={false} style={styles.centerWrap}>
          <MotiView
            from={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "timing", duration: 200 }}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                padding: spacing.lg,
                ...shadows.xl,
              },
            ]}
          >
            <Text
              style={{
                color: colors.text,
                fontFamily: typography.fonts.headingBold,
                fontSize: typography.sizes.lg,
                textAlign: "center",
                marginBottom: spacing.md,
              }}
            >
              {title}
            </Text>

            {/* month header with prev / next */}
            <View style={styles.monthRow}>
              <Pressable
                onPress={() => canGoPrev && step(-1)}
                disabled={!canGoPrev}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                style={({ pressed }) => [
                  styles.navBtn,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderRadius: radius.pill,
                    opacity: !canGoPrev ? 0.35 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </Pressable>

              <Text
                style={{
                  color: colors.text,
                  fontFamily: typography.fonts.bodySemi,
                  fontSize: typography.sizes.md,
                }}
              >
                {MONTHS[view.m1 - 1]} {view.y}
              </Text>

              <Pressable
                onPress={() => step(1)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Next month"
                style={({ pressed }) => [
                  styles.navBtn,
                  { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </Pressable>
            </View>

            {/* weekday labels */}
            <View style={styles.grid}>
              {WEEKDAYS.map((w, i) => (
                <View key={`wd-${i}`} style={styles.cell}>
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontFamily: typography.fonts.bodySemi,
                      fontSize: typography.sizes.xs,
                    }}
                  >
                    {w}
                  </Text>
                </View>
              ))}
            </View>

            {/* days */}
            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (day == null) return <View key={`b-${i}`} style={styles.cell} />;
                const ymd = toYmd(view.y, view.m1, day);
                const disabled = ymd < floor;
                const isSelected = value === ymd;
                return (
                  <View key={`d-${day}`} style={styles.cell}>
                    <Pressable
                      onPress={() => !disabled && choose(day)}
                      disabled={disabled}
                      accessibilityRole="button"
                      accessibilityLabel={ymd}
                      accessibilityState={{ selected: isSelected, disabled }}
                      style={({ pressed }) => [
                        styles.day,
                        {
                          backgroundColor: isSelected ? colors.primary : "transparent",
                          borderRadius: radius.pill,
                          opacity: disabled ? 0.28 : pressed ? 0.6 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: isSelected ? colors.white : colors.text,
                          fontFamily: isSelected
                            ? typography.fonts.bodySemi
                            : typography.fonts.body,
                          fontSize: typography.sizes.sm,
                        }}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [
                styles.closeBtn,
                { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, opacity: pressed ? 0.85 : 1, marginTop: spacing.md },
              ]}
            >
              <Text
                style={{
                  color: colors.text,
                  fontFamily: typography.fonts.bodySemi,
                  fontSize: typography.sizes.md,
                }}
              >
                Close
              </Text>
            </Pressable>
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
    maxWidth: 360,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  navBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  day: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
  },
});
