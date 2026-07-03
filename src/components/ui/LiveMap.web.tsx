import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeContext";
import { buildMapHtml, LiveMapProps } from "@/components/ui/LiveMap.shared";

/**
 * Web implementation — renders the same Leaflet map inside an <iframe>
 * (react-native-webview isn't reliable on web).
 */
export const LiveMap: React.FC<LiveMapProps> = ({
  markers,
  height = 170,
  zoom,
  style,
}) => {
  const { colors, radius, isDark } = useTheme();
  const html = buildMapHtml(markers, {
    zoom,
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    bg: colors.surfaceAlt,
    dark: isDark,
  });

  return (
    <View
      style={[
        styles.container,
        { height, borderRadius: radius.lg, borderColor: colors.border },
        style as ViewStyle,
      ]}
      accessibilityLabel="Map"
    >
      <iframe
        srcDoc={html}
        title="Map"
        style={{ border: "none", width: "100%", height: "100%" }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
