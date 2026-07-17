import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";

import { useTheme } from "@/theme/ThemeContext";
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { useUserLocation } from "@/hooks/useUserLocation";
import { distanceMeters } from "@/utils/geo";
import { useFavorites } from "@/hooks/useFavorites";
import { haptics } from "@/utils/haptics";
import { spotService, type SpotFilters } from "@/services/spotService";
import { placesService, type Place } from "@/services/placesService";
import type { ParkingSpot } from "@/models/types";

import { Input } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { MapPreview, type MapPin } from "@/components/ui/MapPreview";
import { LiveMap } from "@/components/ui/LiveMap";
import type { LiveMarker } from "@/components/ui/LiveMap.shared";
import { SpotCard } from "@/components/ui/SpotCard";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SearchEmpty } from "@/components/illustrations";

type VehicleFilter = "car" | "bike" | "suv";

interface ActiveFilters {
  vehicle: VehicleFilter | null;
  freeOnly: boolean;
  budget: boolean; // <= ₹250 / day
  nearby: boolean; // <= 500 m
}

const DEFAULT_FILTERS: ActiveFilters = {
  vehicle: null,
  freeOnly: false,
  budget: false,
  nearby: false,
};

export default function Explore() {
  const navigation = useNavigation<any>();
  const { colors, spacing, typography, radius, shadows } = useTheme();
  const { isFavorite, toggle } = useFavorites();

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);
  const [focusedPlace, setFocusedPlace] = useState<Place | null>(null);
  const debouncedQuery = useDebounce(query, 350);

  const serviceFilters = useMemo<SpotFilters>(
    () => ({
      vehicleType: filters.vehicle,
      freeOnly: filters.freeOnly,
      maxPrice: filters.budget ? 250 : null,
      sort: "recommended",
    }),
    [filters]
  );

  const results = useAsync<ParkingSpot[]>(
    () => spotService.search(debouncedQuery, serviceFilters),
    [debouncedQuery, serviceFilters]
  );

  // Real place lookup (free OpenStreetMap geocoding via Photon).
  const placeResults = useAsync<Place[]>(
    () => placesService.search(debouncedQuery),
    [debouncedQuery]
  );

  // "nearby" = within 5 km of where the user ACTUALLY is (real GPS). When the
  // location isn't available the filter is a no-op rather than lying.
  const userLoc = useUserLocation();
  const spots = useMemo(() => {
    const list = results.data ?? [];
    if (!filters.nearby || !userLoc) return list;
    return list.filter(
      (s) =>
        distanceMeters(userLoc.latitude, userLoc.longitude, s.latitude, s.longitude) <=
        5000
    );
  }, [results.data, filters.nearby, userLoc]);

  const pins = useMemo<MapPin[]>(() => {
    if (spots.length === 0) return [{ x: 0.5, y: 0.5, primary: true }];
    // Spread up to 6 pins pseudo-randomly across the stylised map.
    return spots.slice(0, 6).map((s, i) => {
      const hash = (s.id.charCodeAt(s.id.length - 1) || 50) + i * 37;
      return {
        x: 0.14 + ((hash * 7) % 72) / 100,
        y: 0.16 + ((hash * 13) % 64) / 100,
        primary: i === 0,
      };
    });
  }, [spots]);

  const mapMarkers = useMemo<LiveMarker[]>(() => {
    const spotMarkers = spots.slice(0, 10).map((s, i) => ({
      latitude: s.latitude,
      longitude: s.longitude,
      title: s.title,
      primary: !focusedPlace && i === 0,
    }));
    // When a real place is selected, center the map on it (primary marker).
    if (focusedPlace) {
      return [
        {
          latitude: focusedPlace.latitude,
          longitude: focusedPlace.longitude,
          title: focusedPlace.name,
          primary: true,
        },
        ...spotMarkers,
      ];
    }
    return spotMarkers;
  }, [spots, focusedPlace]);

  const activeCount =
    (filters.vehicle ? 1 : 0) +
    (filters.freeOnly ? 1 : 0) +
    (filters.budget ? 1 : 0) +
    (filters.nearby ? 1 : 0);

  const setVehicle = useCallback((v: VehicleFilter) => {
    setFilters((f) => ({ ...f, vehicle: f.vehicle === v ? null : v }));
  }, []);

  const clearAll = useCallback(() => {
    haptics.light();
    setFilters(DEFAULT_FILTERS);
    setQuery("");
    setFocusedPlace(null);
  }, []);

  const onChangeQuery = useCallback((t: string) => {
    setQuery(t);
    setFocusedPlace(null);
  }, []);

  const onSelectPlace = useCallback((place: Place) => {
    haptics.light();
    setFocusedPlace(place);
    setQuery(place.name);
  }, []);

  const openSpot = useCallback(
    (id: string) => navigation.navigate("SpotDetail", { id }),
    [navigation]
  );

  const submitSearch = useCallback(() => {
    if (query.trim().length === 0) return;
    navigation.navigate("SearchResults", { query: query.trim() });
  }, [navigation, query]);

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.flex, { backgroundColor: colors.bg }]}
    >
      {/* Search + filters header */}
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm }}>
        <Text
          style={{
            color: colors.text,
            fontFamily: typography.fonts.headingBold,
            fontSize: typography.sizes.xxl,
            marginBottom: spacing.md,
          }}
        >
          Explore parking
        </Text>

        <Input
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Search any city, town, station or area"
          iconLeft={<Ionicons name="search" size={20} color={colors.textMuted} />}
          right={
            query.length > 0 ? (
              <Pressable
                onPress={() => {
                  setQuery("");
                  setFocusedPlace(null);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </Pressable>
            ) : undefined
          }
        />

        {/* Real place suggestions (free OSM geocoding) */}
        {query.trim().length >= 2 && !focusedPlace ? (
          <View
            style={[
              styles.placePanel,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.md,
                ...shadows.sm,
              },
            ]}
          >
            {placeResults.loading ? (
              <View style={styles.placeRowLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text
                  style={{
                    marginLeft: spacing.sm,
                    color: colors.textSecondary,
                    fontFamily: typography.fonts.body,
                    fontSize: typography.sizes.sm,
                  }}
                >
                  Searching places…
                </Text>
              </View>
            ) : (placeResults.data ?? []).length === 0 ? (
              <Text
                style={[
                  styles.placeEmpty,
                  { color: colors.textMuted, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm },
                ]}
              >
                No places found for “{query.trim()}”.
              </Text>
            ) : (
              (placeResults.data ?? []).map((pl) => (
                <Pressable
                  key={pl.id}
                  onPress={() => onSelectPlace(pl)}
                  accessibilityRole="button"
                  accessibilityLabel={pl.name}
                  style={({ pressed }) => [styles.placeRow, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View style={[styles.placeIcon, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="location-outline" size={15} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{ color: colors.text, fontFamily: typography.fonts.bodyMedium, fontSize: typography.sizes.sm }}
                    >
                      {pl.name}
                    </Text>
                    {pl.label ? (
                      <Text
                        numberOfLines={1}
                        style={{ marginTop: 1, color: colors.textMuted, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}
                      >
                        {pl.label}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="locate-outline" size={16} color={colors.textMuted} />
                </Pressable>
              ))
            )}
          </View>
        ) : null}
      </View>

      {/* Filter chips */}
      <View style={{ marginTop: spacing.md }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chipRow, { paddingHorizontal: spacing.xl }]}
        >
          <Chip
            label="Car"
            selected={filters.vehicle === "car"}
            onPress={() => setVehicle("car")}
            icon={
              <Ionicons
                name="car-sport-outline"
                size={15}
                color={filters.vehicle === "car" ? colors.white : colors.textSecondary}
              />
            }
          />
          <Chip
            label="Bike"
            selected={filters.vehicle === "bike"}
            onPress={() => setVehicle("bike")}
            icon={
              <Ionicons
                name="bicycle-outline"
                size={15}
                color={filters.vehicle === "bike" ? colors.white : colors.textSecondary}
              />
            }
          />
          <Chip
            label="SUV"
            selected={filters.vehicle === "suv"}
            onPress={() => setVehicle("suv")}
            icon={
              <Ionicons
                name="car-outline"
                size={15}
                color={filters.vehicle === "suv" ? colors.white : colors.textSecondary}
              />
            }
          />
          <Chip
            label="Free"
            selected={filters.freeOnly}
            onPress={() => setFilters((f) => ({ ...f, freeOnly: !f.freeOnly }))}
          />
          <Chip
            label="Under ₹250"
            selected={filters.budget}
            onPress={() => setFilters((f) => ({ ...f, budget: !f.budget }))}
          />
          <Chip
            label="Within 500m"
            selected={filters.nearby}
            onPress={() => setFilters((f) => ({ ...f, nearby: !f.nearby }))}
          />
          {activeCount > 0 ? (
            <Chip label="Clear" onPress={clearAll} />
          ) : null}
        </ScrollView>
      </View>

      {/* Results list with a map header */}
      {results.loading ? (
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          <LiveMap markers={mapMarkers} height={170} />
          <View style={{ height: spacing.lg }} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ marginBottom: spacing.md }}>
              <SkeletonCard />
            </View>
          ))}
        </ScrollView>
      ) : results.error ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ErrorState
            subtitle="We couldn't load parking spots. Please try again."
            onRetry={results.refetch}
          />
        </View>
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.lg,
            paddingBottom: spacing.huge,
          }}
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.lg }}>
              <LiveMap markers={mapMarkers} height={170} />
              <Text
                style={{
                  marginTop: spacing.md,
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.bodyMedium,
                  fontSize: typography.sizes.sm,
                }}
              >
                {spots.length} {spots.length === 1 ? "spot" : "spots"} found
                {focusedPlace
                  ? ` near ${focusedPlace.name}`
                  : query.trim()
                  ? ` for “${query.trim()}”`
                  : ""}
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item, index }) => (
            <MotiView
              from={{ opacity: 0, translateY: 14 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 320, delay: Math.min(index, 6) * 50 }}
            >
              <SpotCard
                spot={item}
                variant="list"
                favorite={isFavorite(item.id)}
                onToggleFavorite={() => toggle(item.id)}
                onPress={() => openSpot(item.id)}
              />
            </MotiView>
          )}
          ListEmptyComponent={
            focusedPlace ? (
              <EmptyState
                illustration={SearchEmpty}
                title={`No spots in ${focusedPlace.name} yet`}
                subtitle="This place is on the map, but no one has listed parking here yet. Be the first to host it!"
                actionLabel="List your space"
                onAction={() => navigation.navigate("ListSpace")}
              />
            ) : (
              <EmptyState
                illustration={SearchEmpty}
                title="No spots match your search"
                subtitle={
                  query.trim()
                    ? "Try a different station or clear your filters."
                    : "Adjust your filters to see more parking options."
                }
                actionLabel={activeCount > 0 || query.trim() ? "Clear filters" : undefined}
                onAction={activeCount > 0 || query.trim() ? clearAll : undefined}
              />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  placePanel: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
    overflow: "hidden",
  },
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  placeIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  placeRowLoading: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  placeEmpty: {
    padding: 14,
  },
});
