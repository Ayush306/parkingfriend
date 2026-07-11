import React, { useEffect, useMemo, useRef } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeContext";
import { buildPickerHtml, type PickerLandmark } from "@/components/ui/LiveMap.shared";

export interface MapPickerProps {
  center: { latitude: number; longitude: number };
  landmarks?: PickerLandmark[];
  onPick: (latitude: number, longitude: number, label?: string | null) => void;
  height?: number;
  zoom?: number;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Web interactive location picker — the same Leaflet map inside an <iframe>.
 * The iframe posts picked coordinates to the parent window; we listen for
 * those messages and forward them to `onPick`.
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

  // Keep the latest onPick without re-subscribing the window listener.
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    function handler(ev: MessageEvent) {
      try {
        const data =
          typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
        if (
          data &&
          data.type === "pick" &&
          isFinite(Number(data.latitude)) &&
          isFinite(Number(data.longitude))
        ) {
          onPickRef.current(
            Number(data.latitude),
            Number(data.longitude),
            data.label ?? null
          );
        }
      } catch {
        /* ignore non-JSON / unrelated messages */
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <View
      style={[
        styles.container,
        { height, borderRadius: radius.lg, borderColor: colors.border },
        style as ViewStyle,
      ]}
      accessibilityLabel="Location picker map"
    >
      <iframe
        srcDoc={html}
        title="Location picker"
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
