import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import { useTheme } from "@/theme/ThemeContext";
import { buildMapHtml, LiveMapProps } from "@/components/ui/LiveMap.shared";

/**
 * Native implementation — renders the Leaflet map inside a WebView.
 * (The web build uses LiveMap.web.tsx with an <iframe> instead.)
 */
export const LiveMap: React.FC<LiveMapProps> = ({
  markers,
  height = 170,
  zoom,
  style,
  route,
}) => {
  const { colors, radius, isDark } = useTheme();
  const html = buildMapHtml(markers, {
    zoom,
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    bg: colors.surfaceAlt,
    dark: isDark,
    route,
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
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.web}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        androidLayerType="hardware"
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
  web: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
