import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/theme/ThemeContext";
import { formatCurrency } from "@/utils/format";

export interface PriceTagProps {
  amount: number;
  period?: string;
  free?: boolean;
}

export function PriceTag({ amount, period, free }: PriceTagProps) {
  const { colors, typography } = useTheme();

  if (free) {
    return (
      <View style={styles.row}>
        <Text
          style={{
            fontFamily: typography.fonts.headingBold,
            fontSize: typography.sizes.lg,
            color: colors.success,
          }}
        >
          Free
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text
        style={{
          fontFamily: typography.fonts.headingBold,
          fontSize: typography.sizes.xl,
          color: colors.text,
        }}
      >
        {formatCurrency(amount)}
      </Text>
      {period ? (
        <Text
          style={{
            fontFamily: typography.fonts.body,
            fontSize: typography.sizes.sm,
            color: colors.textSecondary,
            marginLeft: 2,
          }}
        >
          /{period}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "baseline",
  },
});
