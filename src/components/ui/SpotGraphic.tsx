import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useTheme } from "@/theme/ThemeContext";
import type { VehicleType } from "@/models/types";

const MCI_BY_TYPE: Record<
  VehicleType,
  keyof typeof MaterialCommunityIcons.glyphMap
> = {
  car: "car",
  bike: "motorbike",
  bicycle: "bicycle",
  suv: "car-estate",
};

export interface SpotGraphicProps {
  /** The listing's vehicle types — decides which icons to draw (max 3). */
  vehicleTypes?: VehicleType[] | null;
  /** Icon glyph size; scale with the tile (default 30). */
  iconSize?: number;
  /** Sizing/rounding for the tile — pass the same style the old Image used. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Brand-gradient tile with the listing's vehicle icons (car / motorbike /
 * bicycle) — shown wherever a spot has no real photos, instead of the old
 * random stock image. A car-only space shows a car, a bike+bicycle space
 * shows both, so the thumbnail says what actually fits there.
 */
export function SpotGraphic({
  vehicleTypes,
  iconSize = 30,
  style,
}: SpotGraphicProps) {
  const { gradients } = useTheme();
  const types = (vehicleTypes ?? [])
    .filter((t, idx, arr) => !!MCI_BY_TYPE[t] && arr.indexOf(t) === idx)
    .slice(0, 3);
  const shown: VehicleType[] = types.length ? types : ["car"];

  return (
    <LinearGradient
      colors={gradients.primary as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.tile, style]}
    >
      <View style={styles.row}>
        {shown.map((t) => (
          <MaterialCommunityIcons
            key={t}
            name={MCI_BY_TYPE[t]}
            size={iconSize}
            color="rgba(255,255,255,0.95)"
          />
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
