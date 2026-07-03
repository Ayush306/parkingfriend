import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/ThemeContext";

export interface StepIndicatorProps {
  steps: number;
  current: number;
  labels?: string[];
  style?: ViewStyle | ViewStyle[];
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  current,
  labels,
  style,
}) => {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={[styles.container, style as ViewStyle]}>
      <View style={styles.row}>
        {Array.from({ length: steps }).map((_, i) => {
          const done = i < current;
          const active = i === current;
          const reached = done || active;
          return (
            <React.Fragment key={i}>
              <View style={styles.stepCol}>
                <MotiView
                  animate={{
                    backgroundColor: reached
                      ? colors.primary
                      : colors.surfaceAlt,
                    scale: active ? 1.06 : 1,
                  }}
                  transition={{ type: "timing", duration: 260 }}
                  style={[
                    styles.dot,
                    {
                      borderColor: reached ? colors.primary : colors.border,
                    },
                  ]}
                  accessibilityLabel={
                    labels?.[i] ?? `Step ${i + 1}`
                  }
                  accessibilityState={{ selected: active }}
                >
                  {done ? (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={colors.white}
                    />
                  ) : (
                    <Text
                      style={{
                        color: reached ? colors.white : colors.textMuted,
                        fontFamily: typography.fonts.bodySemi,
                        fontSize: typography.sizes.sm,
                      }}
                    >
                      {i + 1}
                    </Text>
                  )}
                </MotiView>
              </View>
              {i < steps - 1 ? (
                <View
                  style={[
                    styles.line,
                    {
                      backgroundColor: done ? colors.primary : colors.border,
                    },
                  ]}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
      {labels && labels.length > 0 ? (
        <View style={[styles.labels, { marginTop: spacing.sm }]}>
          {labels.slice(0, steps).map((label, i) => (
            <Text
              key={i}
              numberOfLines={1}
              style={{
                flex: 1,
                textAlign: "center",
                color: i === current ? colors.text : colors.textMuted,
                fontFamily:
                  i === current
                    ? typography.fonts.bodySemi
                    : typography.fonts.body,
                fontSize: typography.sizes.xs,
              }}
            >
              {label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepCol: {
    alignItems: "center",
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  line: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    marginHorizontal: 4,
  },
  labels: {
    flexDirection: "row",
  },
});
