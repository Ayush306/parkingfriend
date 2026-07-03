import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeContext";

export interface DividerProps {
  style?: StyleProp<ViewStyle>;
  inset?: number;
  vertical?: boolean;
}

export function Divider({ style, inset = 0, vertical }: DividerProps) {
  const { colors } = useTheme();

  if (vertical) {
    return (
      <View
        style={[
          {
            width: StyleSheet.hairlineWidth,
            alignSelf: "stretch",
            backgroundColor: colors.border,
            marginVertical: inset,
          },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginHorizontal: inset,
        },
        style,
      ]}
    />
  );
}
