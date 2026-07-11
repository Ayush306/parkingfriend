import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";

import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MapPicker } from "@/components/ui/MapPicker";
import type { PickerLandmark } from "@/components/ui/LiveMap.shared";
import { SuccessCheck } from "@/components/illustrations/SuccessCheck";
import { useTheme } from "@/theme/ThemeContext";
import { useToast } from "@/components/ui/Toast";
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { haptics } from "@/utils/haptics";
import { formatCurrency } from "@/utils/format";
import { hostService, type CreateListingPayload } from "@/services/hostService";
import { placesService, type Place } from "@/services/placesService";
import { SPOT_TYPE_OPTIONS, type SpotTypeId } from "@/constants";
import type { ParkingSpot } from "@/models/types";

/** Gurugram centre — where the map starts before a location is chosen. */
const DEFAULT_CENTER = { latitude: 28.4595, longitude: 77.0266 };

interface Picked {
  latitude: number;
  longitude: number;
  label: string;
}

/** Short, human label from a place (drops the trailing region detail). */
function fullLabel(p: Place): string {
  return p.label ? `${p.name} · ${p.label}` : p.name;
}

export default function ListSpace() {
  const navigation = useNavigation<any>();
  const toast = useToast();
  const { colors, spacing, typography, radius } = useTheme();

  // --- location (the only mandatory input) ---
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [locating, setLocating] = useState(false);
  const debouncedQuery = useDebounce(query, 350);

  // --- optional details ---
  const [type, setType] = useState<SpotTypeId>("home");
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<ParkingSpot | null>(null);

  // Real place suggestions for the search box (free Photon geocoding).
  const placeResults = useAsync<Place[]>(
    () => placesService.search(debouncedQuery),
    [debouncedQuery]
  );

  // Real landmarks around the current map centre (free Photon reverse).
  const nearbyResults = useAsync<Place[]>(
    () => placesService.nearby(mapCenter.latitude, mapCenter.longitude, 8),
    [mapCenter.latitude, mapCenter.longitude]
  );

  const landmarks = useMemo<PickerLandmark[]>(
    () =>
      (nearbyResults.data ?? []).map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        label: p.name,
      })),
    [nearbyResults.data]
  );

  const onChangeQuery = useCallback((t: string) => {
    setQuery(t);
    setShowSuggestions(true);
  }, []);

  // Pick from the search dropdown → recenter the map + set the spot.
  const onSelectPlace = useCallback((place: Place) => {
    haptics.selection();
    const label = fullLabel(place);
    setMapCenter({ latitude: place.latitude, longitude: place.longitude });
    setPicked({ latitude: place.latitude, longitude: place.longitude, label });
    setQuery(place.name);
    setShowSuggestions(false);
    setAddress((prev) => (prev && prev.trim() ? prev : label));
  }, []);

  // Tap a nearby-landmark chip → recenter + set the spot.
  const onSelectLandmark = useCallback((place: Place) => {
    haptics.selection();
    const label = fullLabel(place);
    setMapCenter({ latitude: place.latitude, longitude: place.longitude });
    setPicked({ latitude: place.latitude, longitude: place.longitude, label });
    setAddress((prev) => (prev && prev.trim() ? prev : label));
  }, []);

  // Tap the map / drag the pin / tap a landmark pin.
  const onPickFromMap = useCallback(
    (lat: number, lng: number, label?: string | null) => {
      haptics.selection();
      setPicked({ latitude: lat, longitude: lng, label: label ?? "Pinned location" });
      if (!label) {
        // Reverse-geocode the dropped pin to name it + auto-fill address.
        placesService
          .reverse(lat, lng)
          .then((place) => {
            if (!place) return;
            const label2 = fullLabel(place);
            setPicked((prev) =>
              prev && prev.latitude === lat && prev.longitude === lng
                ? { ...prev, label: label2 }
                : prev
            );
            setAddress((prev) => (prev && prev.trim() ? prev : label2));
          })
          .catch(() => {});
      }
    },
    []
  );

  const useMyLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        toast.show(
          "Location permission is needed to use your current spot.",
          "warning"
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      haptics.success();
      setMapCenter({ latitude: lat, longitude: lng });
      setPicked({ latitude: lat, longitude: lng, label: "Your current location" });
      setShowSuggestions(false);
      const place = await placesService.reverse(lat, lng);
      if (place) {
        const label = fullLabel(place);
        setPicked((prev) => (prev ? { ...prev, label } : prev));
        setAddress((prev) => (prev && prev.trim() ? prev : label));
      }
    } catch (e: any) {
      toast.show(e?.message ?? "Couldn't get your location.", "error");
    } finally {
      setLocating(false);
    }
  }, [toast]);

  const handlePublish = async () => {
    if (!picked) {
      haptics.error();
      toast.show("Pick your parking location on the map first.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const shortLabel = (picked.label || query || "")
        .split(" · ")[0]
        .split(",")[0]
        .trim();
      const typeLabel =
        SPOT_TYPE_OPTIONS.find((o) => o.id === type)?.label ?? "Parking";
      const autoTitle = `${typeLabel} parking${
        shortLabel ? ` near ${shortLabel}` : ""
      }`;
      const priceNum = parseInt(price.replace(/[^0-9]/g, ""), 10);
      const hasPrice = !isNaN(priceNum) && priceNum > 0;

      const payload: CreateListingPayload = {
        title: title.trim() || autoTitle,
        type,
        vehicleTypes: ["car"],
        address: address.trim(),
        area: shortLabel,
        landmark:
          picked.label && picked.label !== "Pinned location" ? picked.label : "",
        nearStation: shortLabel,
        latitude: picked.latitude,
        longitude: picked.longitude,
        pricePerHour: hasPrice ? Math.max(10, Math.round(priceNum / 6)) : 0,
        pricePerDay: hasPrice ? priceNum : 0,
        isFree: !hasPrice,
        amenities: [],
        availableFrom: "08:00",
        availableTo: "20:00",
        instructions: "",
        images: [],
      };
      const listing = await hostService.createListing(payload);
      haptics.success();
      setCreated(listing);
    } catch (e: any) {
      haptics.error();
      toast.show(e?.message ?? "Couldn't publish your space.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldLabel = {
    color: colors.textSecondary,
    fontFamily: typography.fonts.bodyMedium,
    fontSize: typography.sizes.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  } as const;

  // ---- Success confirmation ----
  if (created) {
    return (
      <Screen scroll padded>
        <Header showBack title="Space published" onBack={() => navigation.goBack()} />
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", damping: 14, stiffness: 180 }}
          style={{ alignItems: "center", marginTop: spacing.huge }}
        >
          <SuccessCheck size={160} color={colors.success} />
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fonts.headingBold,
              fontSize: typography.sizes.xxl,
              marginTop: spacing.lg,
              textAlign: "center",
            }}
          >
            You're live!
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.body,
              fontSize: typography.sizes.md,
              lineHeight: 23,
              textAlign: "center",
              marginTop: spacing.sm,
              paddingHorizontal: spacing.md,
            }}
          >
            "{created.title}" is now on the map. Drivers nearby can find and
            request it right away.
          </Text>
        </MotiView>

        <Card elevated style={{ marginTop: spacing.xxl }}>
          <View style={styles.summaryRow}>
            <Image
              source={{ uri: created.images[0] }}
              style={[
                styles.summaryImg,
                { backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
              ]}
            />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text
                numberOfLines={2}
                style={{
                  color: colors.text,
                  fontFamily: typography.fonts.bodySemi,
                  fontSize: typography.sizes.md,
                }}
              >
                {created.title}
              </Text>
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: typography.fonts.bodySemi,
                  fontSize: typography.sizes.md,
                  marginTop: spacing.xs,
                }}
              >
                {created.isFree
                  ? "Free"
                  : `${formatCurrency(created.pricePerDay)} / day`}
              </Text>
            </View>
          </View>
        </Card>

        <Button
          label="View incoming requests"
          variant="gradient"
          fullWidth
          onPress={() => navigation.replace("HostRequests")}
          iconRight={<Ionicons name="arrow-forward" size={18} color={colors.white} />}
          style={{ marginTop: spacing.xl }}
        />
        <Button
          label="Back to profile"
          variant="ghost"
          fullWidth
          onPress={() => navigation.goBack()}
          style={{ marginTop: spacing.sm }}
        />
      </Screen>
    );
  }

  // ---- Form ----
  const suggestions = placeResults.data ?? [];
  const showPanel = query.trim().length >= 2 && showSuggestions;

  return (
    <Screen scroll padded>
      <Header
        showBack
        title="List your space"
        subtitle="Just pin your location — that's the only must."
        onBack={() => navigation.goBack()}
      />

      {/* Location (mandatory) */}
      <Card elevated style={{ marginBottom: spacing.lg }}>
        <Text
          style={{
            color: colors.text,
            fontFamily: typography.fonts.heading,
            fontSize: typography.sizes.md,
            marginBottom: spacing.sm,
          }}
        >
          Where is your parking?
        </Text>

        <Input
          label="Search a city, town, station or area"
          value={query}
          onChangeText={onChangeQuery}
          placeholder="e.g. Baraut, Huda City Centre, Sector 29…"
          iconLeft={<Ionicons name="search" size={18} color={colors.textMuted} />}
        />

        {/* Real place suggestions */}
        {showPanel ? (
          <View
            style={[
              styles.panel,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.md,
                marginTop: spacing.xs,
              },
            ]}
          >
            {placeResults.loading ? (
              <View style={styles.panelLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text
                  style={{
                    marginLeft: spacing.sm,
                    color: colors.textSecondary,
                    fontFamily: typography.fonts.body,
                    fontSize: typography.sizes.sm,
                  }}
                >
                  Finding places…
                </Text>
              </View>
            ) : suggestions.length > 0 ? (
              suggestions.map((place) => (
                <Pressable
                  key={place.id}
                  onPress={() => onSelectPlace(place)}
                  style={({ pressed }) => [
                    styles.panelRow,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: pressed ? colors.surfaceAlt : "transparent",
                    },
                  ]}
                >
                  <Ionicons name="location-outline" size={18} color={colors.primary} />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: colors.text,
                        fontFamily: typography.fonts.bodyMedium,
                        fontSize: typography.sizes.sm,
                      }}
                    >
                      {place.name}
                    </Text>
                    {place.label ? (
                      <Text
                        numberOfLines={1}
                        style={{
                          color: colors.textMuted,
                          fontFamily: typography.fonts.body,
                          fontSize: typography.sizes.xs,
                          marginTop: 1,
                        }}
                      >
                        {place.label}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))
            ) : (
              <Text
                style={{
                  padding: spacing.md,
                  color: colors.textMuted,
                  fontFamily: typography.fonts.body,
                  fontSize: typography.sizes.sm,
                }}
              >
                No matching places. Try a nearby town or landmark.
              </Text>
            )}
          </View>
        ) : null}

        {/* Use my location */}
        <Button
          label={locating ? "Getting your location…" : "Use my current location"}
          variant="outline"
          fullWidth
          loading={locating}
          onPress={useMyLocation}
          iconLeft={<Ionicons name="locate" size={18} color={colors.primary} />}
          style={{ marginTop: spacing.md }}
        />

        {/* Interactive map */}
        <View style={{ marginTop: spacing.md }}>
          <MapPicker
            center={mapCenter}
            landmarks={landmarks}
            onPick={onPickFromMap}
            height={280}
          />
        </View>
        <Text
          style={{
            color: colors.textMuted,
            fontFamily: typography.fonts.body,
            fontSize: typography.sizes.xs,
            marginTop: spacing.xs,
            textAlign: "center",
          }}
        >
          Tap the map or drag the pin to set your exact spot.
        </Text>

        {/* Nearby landmarks */}
        {landmarks.length > 0 ? (
          <>
            <Text style={fieldLabel}>Nearby landmarks — tap to pick</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: spacing.md }}
            >
              {(nearbyResults.data ?? []).map((place) => (
                <Pressable
                  key={place.id}
                  onPress={() => onSelectLandmark(place)}
                  style={({ pressed }) => [
                    styles.lmChip,
                    {
                      backgroundColor: pressed ? colors.primaryLight : colors.surfaceAlt,
                      borderColor: colors.border,
                      borderRadius: radius.pill,
                      marginRight: spacing.sm,
                    },
                  ]}
                >
                  <Ionicons name="pin" size={13} color={colors.primary} />
                  <Text
                    numberOfLines={1}
                    style={{
                      marginLeft: 5,
                      maxWidth: 150,
                      color: colors.text,
                      fontFamily: typography.fonts.bodyMedium,
                      fontSize: typography.sizes.xs,
                    }}
                  >
                    {place.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* Selected confirmation */}
        {picked ? (
          <View
            style={[
              styles.pickedBox,
              {
                backgroundColor: colors.primaryLight,
                borderRadius: radius.md,
                marginTop: spacing.md,
              },
            ]}
          >
            <Ionicons name="location" size={20} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.bodyMedium,
                  fontSize: typography.sizes.xs,
                }}
              >
                Selected location
              </Text>
              <Text
                numberOfLines={2}
                style={{
                  color: colors.text,
                  fontFamily: typography.fonts.bodySemi,
                  fontSize: typography.sizes.sm,
                  marginTop: 1,
                }}
              >
                {picked.label}
              </Text>
              <Text
                style={{
                  color: colors.textMuted,
                  fontFamily: typography.fonts.body,
                  fontSize: typography.sizes.xs,
                  marginTop: 1,
                }}
              >
                {picked.latitude.toFixed(5)}, {picked.longitude.toFixed(5)}
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          </View>
        ) : (
          <View
            style={[
              styles.hintBox,
              {
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.md,
                marginTop: spacing.md,
              },
            ]}
          >
            <Ionicons name="hand-left-outline" size={18} color={colors.textMuted} />
            <Text
              style={{
                marginLeft: spacing.sm,
                flex: 1,
                color: colors.textSecondary,
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.sm,
              }}
            >
              Search, use your location, tap a landmark, or tap the map to set
              your spot.
            </Text>
          </View>
        )}
      </Card>

      {/* Parking type (quick) */}
      <Card elevated style={{ marginBottom: spacing.lg }}>
        <Text
          style={{
            color: colors.text,
            fontFamily: typography.fonts.heading,
            fontSize: typography.sizes.md,
            marginBottom: spacing.sm,
          }}
        >
          Parking type
        </Text>
        <View style={styles.chipWrap}>
          {SPOT_TYPE_OPTIONS.map((opt) => (
            <View key={opt.id} style={styles.chipItem}>
              <Chip
                label={opt.label}
                selected={type === opt.id}
                onPress={() => {
                  haptics.selection();
                  setType(opt.id);
                }}
                icon={
                  <Ionicons
                    name={opt.icon as any}
                    size={15}
                    color={type === opt.id ? colors.white : colors.textSecondary}
                  />
                }
              />
            </View>
          ))}
        </View>
      </Card>

      {/* Optional details */}
      <Card elevated style={{ marginBottom: spacing.lg }}>
        <View style={styles.optionalHead}>
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fonts.heading,
              fontSize: typography.sizes.md,
            }}
          >
            A few more details
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontFamily: typography.fonts.bodyMedium,
              fontSize: typography.sizes.xs,
            }}
          >
            optional
          </Text>
        </View>

        <Input
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Auto-filled from your location if left blank"
          maxLength={60}
        />
        <View style={{ height: spacing.md }} />
        <Input
          label="Address"
          value={address}
          onChangeText={setAddress}
          placeholder="House / tower, block (optional)"
          iconLeft={
            <Ionicons name="home-outline" size={18} color={colors.textMuted} />
          }
        />
        <View style={{ height: spacing.md }} />
        <Input
          label="Price per day"
          value={price}
          onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ""))}
          placeholder="Leave blank to list as free"
          keyboardType="number-pad"
          maxLength={5}
          iconLeft={
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.bodySemi,
                fontSize: typography.sizes.md,
              }}
            >
              ₹
            </Text>
          }
        />
      </Card>

      <Button
        label="Publish space"
        variant="gradient"
        size="lg"
        fullWidth
        loading={submitting}
        onPress={handlePublish}
        iconRight={<Ionicons name="rocket-outline" size={18} color={colors.white} />}
      />
      <Text
        style={{
          color: colors.textMuted,
          fontFamily: typography.fonts.body,
          fontSize: typography.sizes.xs,
          textAlign: "center",
          marginTop: spacing.md,
          lineHeight: 18,
        }}
      >
        Only the map location is required. You can add photos, timings and more
        after publishing.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  panelLoading: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  panelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lmChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickedBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  hintBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  chipItem: {
    marginRight: 8,
    marginBottom: 8,
  },
  optionalHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryImg: {
    width: 72,
    height: 72,
  },
});
