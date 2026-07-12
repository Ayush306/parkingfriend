import React, { useMemo, useState } from "react";
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

import { useTheme } from "@/theme/ThemeContext";
import { useToast } from "@/components/ui/Toast";
import { openDirections } from "@/utils/directions";
import {
  buildMapHtml,
  type LiveMapProps,
} from "@/components/ui/LiveMap.shared";

export interface LiveMapChromeProps extends LiveMapProps {
  /** Renders the HTML host — a WebView on native, an <iframe> on web. */
  renderHtml: (html: string, key: string) => React.ReactNode;
}

/**
 * Shared shell around the Leaflet map:
 *  - INLINE: a calm, gesture-free preview (page scrolling stays smooth) with
 *    an expand hint — tapping anywhere opens the full-screen map.
 *  - FULL SCREEN (modal): fully interactive (drag / pinch-zoom / popups) with
 *    a close button, a GPS "my location" button that drops a blue dot, and a
 *    Google-Maps directions button when the map shows a single destination.
 */
export function LiveMapChrome({
  markers,
  height = 170,
  zoom,
  style,
  route,
  expandable = true,
  renderHtml,
}: LiveMapChromeProps) {
  const { colors, radius, isDark } = useTheme();
  const toast = useToast();

  const [expanded, setExpanded] = useState(false);
  const [locating, setLocating] = useState(false);
  const [userLoc, setUserLoc] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const baseOpts = {
    zoom,
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    bg: colors.surfaceAlt,
    dark: isDark,
    route,
  };

  // Key on VALUE, not identity: screens rebuild the markers array on every
  // data refresh, and a new identity would reload the iframe (re-downloading
  // the whole map style) even though nothing visible changed.
  const markersKey = JSON.stringify(markers);
  const routeKey = JSON.stringify(route ?? null);

  const inlineHtml = useMemo(
    () => buildMapHtml(markers, { ...baseOpts, interactive: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markersKey, zoom, routeKey, colors.primary, colors.secondary, isDark]
  );

  const fullHtml = useMemo(
    () =>
      buildMapHtml(markers, {
        ...baseOpts,
        interactive: true,
        userLocation: userLoc,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markersKey, zoom, routeKey, colors.primary, colors.secondary, isDark, userLoc]
  );

  // Directions make sense when the map has one clear destination.
  const directionsTarget = useMemo(() => {
    if (route?.to) return route.to;
    const primary = markers.filter((m) => m.primary);
    if (primary.length === 1) return primary[0];
    if (markers.length === 1) return markers[0];
    return null;
  }, [route, markers]);

  const locateMe = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        toast.show("Location permission is needed to show where you are.", "warning");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLoc({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch {
      toast.show("Couldn't get your location.", "error");
    } finally {
      setLocating(false);
    }
  };

  const goDirections = async () => {
    if (!directionsTarget) return;
    const ok = await openDirections(
      directionsTarget.latitude,
      directionsTarget.longitude
    );
    if (!ok) toast.show("Couldn't open Google Maps on this device.", "error");
  };

  const fab = (extra?: ViewStyle): ViewStyle[] => [
    styles.fab,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.pill,
    },
    extra ?? {},
  ];

  return (
    <>
      {/* Inline preview */}
      <View
        style={[
          styles.container,
          { height, borderRadius: radius.lg, borderColor: colors.border },
          style as ViewStyle,
        ]}
        accessibilityLabel="Map"
      >
        {renderHtml(inlineHtml, "inline")}
        {expandable ? (
          <>
            <Pressable
              onPress={() => setExpanded(true)}
              accessibilityRole="button"
              accessibilityLabel="Open full map"
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={fab(styles.expandHint)}>
              <Ionicons name="expand-outline" size={18} color={colors.primary} />
            </View>
          </>
        ) : null}
      </View>

      {/* Full-screen interactive map */}
      <Modal
        visible={expanded}
        animationType="slide"
        onRequestClose={() => setExpanded(false)}
      >
        <View style={[styles.full, { backgroundColor: colors.bg }]}>
          {renderHtml(fullHtml, `full-${userLoc ? "loc" : "noloc"}`)}
          <SafeAreaView
            pointerEvents="box-none"
            style={StyleSheet.absoluteFill}
            edges={["top", "bottom"]}
          >
            <Pressable
              onPress={() => setExpanded(false)}
              accessibilityRole="button"
              accessibilityLabel="Close full map"
              style={({ pressed }) => [
                ...fab(styles.closeFab),
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>

            <View pointerEvents="box-none" style={styles.rightRail}>
              <Pressable
                onPress={locateMe}
                disabled={locating}
                accessibilityRole="button"
                accessibilityLabel="Show my location"
                style={({ pressed }) => [
                  ...fab(),
                  { opacity: pressed ? 0.75 : 1 },
                ]}
              >
                {locating ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="locate" size={20} color={colors.primary} />
                )}
              </Pressable>

              {directionsTarget ? (
                <Pressable
                  onPress={goDirections}
                  accessibilityRole="button"
                  accessibilityLabel="Get directions in Google Maps"
                  style={({ pressed }) => [
                    ...fab({ marginTop: 12 }),
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <Ionicons name="navigate" size={20} color={colors.primary} />
                </Pressable>
              ) : null}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  full: {
    flex: 1,
  },
  fab: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  expandHint: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
  },
  closeFab: {
    position: "absolute",
    top: 12,
    left: 12,
  },
  rightRail: {
    position: "absolute",
    right: 12,
    bottom: 28,
    alignItems: "center",
  },
});
