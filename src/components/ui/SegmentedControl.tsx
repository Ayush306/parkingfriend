import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  LayoutChangeEvent,
  ViewStyle,
} from "react-native";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/theme/ThemeContext";

export interface SegmentedControlProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  style?: ViewStyle | ViewStyle[];
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  style,
}) => {
  const { colors, spacing, typography, radius, shadows } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  const index = Math.max(0, options.indexOf(value));
  const count = options.length || 1;
  const pad = 4;
  const segWidth = trackWidth > 0 ? (trackWidth - pad * 2) / count : 0;

  const onLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const handlePress = (opt: string) => {
    if (opt === value) return;
    Haptics.selectionAsync().catch(() => {});
    onChange(opt);
  };

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.track,
        {
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.pill,
          padding: pad,
        },
        style as ViewStyle,
      ]}
      accessibilityRole="tablist"
    >
      {segWidth > 0 ? (
        <MotiView
          animate={{ translateX: index * segWidth }}
          transition={{ type: "spring", damping: 18, stiffness: 220 }}
          style={[
            styles.thumb,
            {
              width: segWidth,
              backgroundColor: colors.surface,
              borderRadius: radius.pill,
              ...shadows.sm,
            },
          ]}
        />
      ) : null}
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => handlePress(opt)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt}
            style={[styles.segment, { paddingVertical: spacing.sm }]}
          >
            <Text
              numberOfLines={1}
              style={{
                color: active ? colors.text : colors.textSecondary,
                fontFamily: active
                  ? typography.fonts.bodySemi
                  : typography.fonts.bodyMedium,
                fontSize: typography.sizes.sm,
                textAlign: "center",
              }}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  thumb: {
    position: "absolute",
    top: 4,
    left: 4,
    bottom: 4,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
});
