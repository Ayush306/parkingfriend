import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import Svg, {
  Rect,
  Path,
  Circle,
  G,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/ThemeContext";

export interface MapPin {
  x: number; // 0..1 relative horizontal position
  y: number; // 0..1 relative vertical position
  primary?: boolean;
}

export interface MapPreviewProps {
  pins?: MapPin[];
  height?: number;
  style?: ViewStyle | ViewStyle[];
}

export const MapPreview: React.FC<MapPreviewProps> = ({
  pins = [{ x: 0.5, y: 0.5, primary: true }],
  height = 160,
  style,
}) => {
  const { colors, radius, isDark } = useTheme();

  const roadColor = isDark ? colors.surfaceAlt : "#E2E8F0";
  const blockColor = isDark ? colors.surface : "#EEF2F6";
  const greenColor = isDark ? colors.primaryLight : "#DCEFE6";

  return (
    <View
      style={[
        styles.container,
        {
          height,
          borderRadius: radius.lg,
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
        },
        style as ViewStyle,
      ]}
      accessibilityLabel="Map preview"
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 320 160"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <SvgGradient id="mapBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.surface} />
            <Stop offset="1" stopColor={colors.surfaceAlt} />
          </SvgGradient>
        </Defs>
        <Rect x="0" y="0" width="320" height="160" fill="url(#mapBg)" />

        {/* park / green blocks */}
        <Rect x="18" y="20" width="70" height="46" rx="8" fill={greenColor} />
        <Rect x="232" y="96" width="72" height="48" rx="8" fill={greenColor} />
        {/* city blocks */}
        <Rect x="120" y="16" width="60" height="40" rx="6" fill={blockColor} />
        <Rect x="196" y="20" width="44" height="36" rx="6" fill={blockColor} />
        <Rect x="24" y="96" width="64" height="46" rx="6" fill={blockColor} />
        <Rect x="120" y="104" width="70" height="40" rx="6" fill={blockColor} />

        {/* roads */}
        <G>
          <Path d="M0 80 H320" stroke={roadColor} strokeWidth="14" />
          <Path d="M104 0 V160" stroke={roadColor} strokeWidth="14" />
          <Path d="M212 0 V160" stroke={roadColor} strokeWidth="10" />
          <Path d="M0 34 H108" stroke={roadColor} strokeWidth="8" />
          {/* road dashes */}
          <Path
            d="M0 80 H320"
            stroke={colors.white}
            strokeWidth="1.5"
            strokeDasharray="8 8"
            opacity={0.6}
          />
        </G>
      </Svg>

      {/* pins overlaid via absolute positioning */}
      {pins.map((pin, i) => (
        <View
          key={i}
          style={[
            styles.pin,
            {
              left: `${Math.min(Math.max(pin.x, 0), 1) * 100}%`,
              top: `${Math.min(Math.max(pin.y, 0), 1) * 100}%`,
            },
          ]}
          pointerEvents="none"
        >
          <View
            style={[
              styles.pinInner,
              {
                backgroundColor: pin.primary ? colors.primary : colors.secondary,
                borderColor: colors.white,
              },
            ]}
          >
            <Ionicons name="location" size={14} color={colors.white} />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  pin: {
    position: "absolute",
    marginLeft: -14,
    marginTop: -28,
  },
  pinInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
