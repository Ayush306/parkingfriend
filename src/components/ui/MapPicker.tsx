import React, { useCallback, useMemo } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useTheme } from "@/theme/ThemeContext";
import { buildPickerHtml, type PickerLandmark } from "@/components/ui/LiveMap.shared";

export interface MapPickerProps {
  /** Where the map is centred. */
  center: { latitude: number; longitude: number };
  /** Landmarks shown as tappable secondary pins. */
  landmarks?: PickerLandmark[];
  /** Fired when the user taps the map, drags the pin, or taps a landmark. */
  onPick: (latitude: number, longitude: number, label?: string | null) => void;
  height?: number;
  zoom?: number;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Native interactive location picker — a Leaflet map inside a WebView that
 * posts the picked coordinates back through `onMessage`.
 * (The web build uses MapPicker.web.tsx with an <iframe> + window messages.)
 */
export const MapPicker: React.FC<MapPickerProps> = ({
  center,
  landmarks,
  onPick,
  height = 280,
  zoom,
  style,
}) => {
  const { colors, radius, isDark } = useTheme();

  const html = useMemo(
    () =>
      buildPickerHtml({
        center,
        landmarks,
        zoom,
        primaryColor: colors.primary,
        secondaryColor: colors.secondary,
        bg: colors.surfaceAlt,
        dark: isDark,
      }),
    [
      center.latitude,
      center.longitude,
      landmarks,
      zoom,
      colors.primary,
      colors.secondary,
      colors.surfaceAlt,
      isDark,
    ]
  );

  const handleMessage = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(e.nativeEvent.data);
        if (
          data &&
          data.type === "pick" &&
          isFinite(Number(data.latitude)) &&
          isFinite(Number(data.longitude))
        ) {
          onPick(Number(data.latitude), Number(data.longitude), data.label ?? null);
        }
      } catch {
        /* ignore malformed messages */
      }
    },
    [onPick]
  );

  return (
    <View
      style={[
        styles.container,
        { height, borderRadius: radius.lg, borderColor: colors.border },
        style as ViewStyle,
      ]}
      accessibilityLabel="Location picker map"
    >
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.web}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
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
