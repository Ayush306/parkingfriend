import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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
import { SpotGraphic } from "@/components/ui/SpotGraphic";
import { useTheme } from "@/theme/ThemeContext";
import { useToast } from "@/components/ui/Toast";
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { haptics } from "@/utils/haptics";
import { formatCurrency } from "@/utils/format";
import { hostService, type CreateListingPayload } from "@/services/hostService";
import { placesService, type Place } from "@/services/placesService";
import { SPOT_TYPE_OPTIONS, VEHICLE_OPTIONS, type SpotTypeId } from "@/constants";
import type { ParkingSpot, VehicleType } from "@/models/types";

/** Gurugram centre — where the map starts before a location is chosen. */
const DEFAULT_CENTER = { latitude: 28.4595, longitude: 77.0266 };

/** Capacity stepper bounds (the server allows up to 50; the form keeps it simple). */
const CAPACITY_MIN = 1;
const CAPACITY_MAX = 20;

/**
 * Suggested per-day price by vehicle type — the "market standard" a host is
 * nudged toward. For a space that fits several kinds we recommend the highest
 * (a car spot is worth more than a bike spot).
 */
const RECOMMENDED_PRICE: Record<VehicleType, number> = {
  bicycle: 10,
  bike: 30,
  car: 50,
  suv: 60,
};

/** Price stepper increment (₹). */
const PRICE_STEP = 5;

type PriceTone = "neutral" | "good" | "low" | "high";

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

  // --- location (mandatory) ---
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [locating, setLocating] = useState(false);
  const debouncedQuery = useDebounce(query, 350);

  // --- what fits, how many, price (mandatory) ---
  const [type, setType] = useState<SpotTypeId>("home");
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [capacity, setCapacity] = useState(1);
  const [price, setPrice] = useState("");
  // Once the host edits the price themselves, vehicle changes stop
  // overwriting it with the suggested default.
  const [priceTouched, setPriceTouched] = useState(false);

  // --- optional details ---
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");

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

  // Pick a vehicle type (single-select — exactly one kind per space).
  const toggleVehicleType = useCallback((id: VehicleType) => {
    haptics.selection();
    setVehicleTypes([id]);
  }, []);

  // Step the capacity up or down, clamped to the stepper bounds.
  const changeCapacity = useCallback((delta: number) => {
    haptics.selection();
    setCapacity((prev) =>
      Math.min(CAPACITY_MAX, Math.max(CAPACITY_MIN, prev + delta))
    );
  }, []);

  // Market-standard price for the chosen vehicle types (highest wins).
  const recommendedPrice = useMemo<number | null>(() => {
    if (vehicleTypes.length === 0) return null;
    return Math.max(...vehicleTypes.map((v) => RECOMMENDED_PRICE[v] ?? 50));
  }, [vehicleTypes]);

  const priceNum = useMemo(() => {
    const n = parseInt((price || "").replace(/[^0-9]/g, ""), 10);
    return isNaN(n) ? 0 : n;
  }, [price]);

  // Pre-fill the market price as the default (car ₹50 / bike ₹30 /
  // bicycle ₹10) whenever the vehicle selection changes — until the host
  // sets a price of their own.
  useEffect(() => {
    if (priceTouched) return;
    setPrice(recommendedPrice != null ? String(recommendedPrice) : "");
  }, [recommendedPrice, priceTouched]);

  // Green when the price sits around the market rate, yellow when it's a
  // notch below (a deal), red when it's above (drivers may skip it).
  const priceStatus = useMemo<{ tone: PriceTone; message: string }>(() => {
    if (recommendedPrice == null) {
      return {
        tone: "neutral",
        message: "Pick what fits above and we'll suggest a fair price.",
      };
    }
    if (priceNum <= 0) {
      return {
        tone: "neutral",
        message: `Suggested ₹${recommendedPrice}/day — the going rate around here.`,
      };
    }
    const band = Math.max(2, Math.round(recommendedPrice * 0.1));
    if (priceNum > recommendedPrice + band) {
      return {
        tone: "high",
        message: `Above the ₹${recommendedPrice} market rate — drivers may skip it.`,
      };
    }
    if (priceNum < recommendedPrice - band) {
      return {
        tone: "low",
        message: `Below the ₹${recommendedPrice} market rate — a deal that fills fast.`,
      };
    }
    return {
      tone: "good",
      message: `Right around the ₹${recommendedPrice} market rate — nicely priced.`,
    };
  }, [recommendedPrice, priceNum]);

  const priceToneColor = useMemo(() => {
    switch (priceStatus.tone) {
      case "good":
        return colors.success;
      case "low":
        return colors.warning;
      case "high":
        return colors.error;
      default:
        return colors.textMuted;
    }
  }, [priceStatus.tone, colors]);

  // Step the price by ₹5; the first tap on an empty field jumps to the
  // suggested market price so hosts start from a sensible number.
  const changePrice = useCallback(
    (delta: number) => {
      haptics.selection();
      setPriceTouched(true);
      setPrice((prev) => {
        const n = parseInt((prev || "").replace(/[^0-9]/g, ""), 10);
        if (isNaN(n)) return String(recommendedPrice ?? PRICE_STEP);
        // Clamp to the same 5-digit ceiling the text field enforces.
        return String(Math.min(99999, Math.max(PRICE_STEP, n + delta)));
      });
    },
    [recommendedPrice]
  );

  const useSuggestedPrice = useCallback(() => {
    if (recommendedPrice == null) return;
    haptics.success();
    setPrice(String(recommendedPrice));
  }, [recommendedPrice]);

  const handlePublish = async () => {
    if (!picked) {
      haptics.error();
      toast.show("Pick your parking location on the map first.", "error");
      return;
    }
    if (vehicleTypes.length === 0) {
      haptics.error();
      toast.show("Select the vehicle type your space is for.", "error");
      return;
    }
    const priceNum = parseInt(price.replace(/[^0-9]/g, ""), 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      haptics.error();
      toast.show("Enter your price per day — at least ₹1.", "error");
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

      const payload: CreateListingPayload = {
        title: title.trim() || autoTitle,
        type,
        vehicleTypes,
        capacity,
        address: address.trim(),
        area: shortLabel,
        landmark:
          picked.label && picked.label !== "Pinned location" ? picked.label : "",
        nearStation: shortLabel,
        latitude: picked.latitude,
        longitude: picked.longitude,
        pricePerHour: Math.max(1, Math.round(priceNum / 8)),
        pricePerDay: priceNum,
        isFree: false,
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
            {created.images[0] ? (
              <Image
                source={{ uri: created.images[0] }}
                style={[
                  styles.summaryImg,
                  { backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
                ]}
              />
            ) : (
              <SpotGraphic
                vehicleTypes={created.vehicleTypes}
                iconSize={24}
                style={[styles.summaryImg, { borderRadius: radius.md }]}
              />
            )}
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
        subtitle="Pin your location, pick what fits, set capacity and a price."
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

      {/* What fits here? (mandatory) */}
      <Card elevated style={{ marginBottom: spacing.lg }}>
        <View style={styles.sectionHead}>
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fonts.heading,
              fontSize: typography.sizes.md,
            }}
          >
            What fits here?
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontFamily: typography.fonts.bodyMedium,
              fontSize: typography.sizes.xs,
            }}
          >
            required
          </Text>
        </View>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.fonts.body,
            fontSize: typography.sizes.sm,
            marginBottom: spacing.sm,
          }}
        >
          Pick the vehicle type your space is for.
        </Text>
        <View style={styles.chipWrap}>
          {VEHICLE_OPTIONS.map((opt) => {
            const selected = vehicleTypes.includes(opt.id);
            return (
              <View key={opt.id} style={styles.chipItem}>
                <Chip
                  label={opt.label}
                  selected={selected}
                  onPress={() => toggleVehicleType(opt.id)}
                  icon={
                    <MaterialCommunityIcons
                      name={opt.mci as any}
                      size={15}
                      color={selected ? colors.white : colors.textSecondary}
                    />
                  }
                />
              </View>
            );
          })}
        </View>
      </Card>

      {/* How many can park? (mandatory) */}
      <Card elevated style={{ marginBottom: spacing.lg }}>
        <View style={styles.sectionHead}>
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fonts.heading,
              fontSize: typography.sizes.md,
            }}
          >
            How many can park?
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontFamily: typography.fonts.bodyMedium,
              fontSize: typography.sizes.xs,
            }}
          >
            required
          </Text>
        </View>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.fonts.body,
            fontSize: typography.sizes.sm,
            marginBottom: spacing.md,
          }}
        >
          Number of vehicles that fit at once.
        </Text>
        <View style={styles.stepperRow}>
          <Pressable
            onPress={() => changeCapacity(-1)}
            disabled={capacity <= CAPACITY_MIN}
            accessibilityRole="button"
            accessibilityLabel="Decrease capacity"
            style={({ pressed }) => [
              styles.stepBtn,
              {
                backgroundColor: pressed ? colors.primaryLight : colors.surfaceAlt,
                borderColor: colors.border,
                borderRadius: radius.pill,
                opacity: capacity <= CAPACITY_MIN ? 0.4 : 1,
              },
            ]}
          >
            <Ionicons name="remove" size={22} color={colors.primary} />
          </Pressable>
          <Text
            style={{
              minWidth: 72,
              textAlign: "center",
              color: colors.text,
              fontFamily: typography.fonts.headingBold,
              fontSize: typography.sizes.xxl,
            }}
          >
            {capacity}
          </Text>
          <Pressable
            onPress={() => changeCapacity(1)}
            disabled={capacity >= CAPACITY_MAX}
            accessibilityRole="button"
            accessibilityLabel="Increase capacity"
            style={({ pressed }) => [
              styles.stepBtn,
              {
                backgroundColor: pressed ? colors.primaryLight : colors.surfaceAlt,
                borderColor: colors.border,
                borderRadius: radius.pill,
                opacity: capacity >= CAPACITY_MAX ? 0.4 : 1,
              },
            ]}
          >
            <Ionicons name="add" size={22} color={colors.primary} />
          </Pressable>
        </View>
      </Card>

      {/* Price (mandatory) — right after "how many can park" */}
      <Card elevated style={{ marginBottom: spacing.lg }}>
        <View style={styles.sectionHead}>
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fonts.heading,
              fontSize: typography.sizes.md,
            }}
          >
            Set your price
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontFamily: typography.fonts.bodyMedium,
              fontSize: typography.sizes.xs,
            }}
          >
            required
          </Text>
        </View>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.fonts.bodyMedium,
            fontSize: typography.sizes.sm,
            marginBottom: spacing.sm,
          }}
        >
          Price per day
        </Text>

        {/* Stepper: [−] [ ₹ input ] [+] */}
        <View style={styles.priceRow}>
          <Pressable
            onPress={() => changePrice(-PRICE_STEP)}
            disabled={priceNum > 0 && priceNum <= PRICE_STEP}
            accessibilityRole="button"
            accessibilityLabel="Decrease price"
            style={({ pressed }) => [
              styles.stepBtn,
              {
                backgroundColor: pressed ? colors.primaryLight : colors.surfaceAlt,
                borderColor: colors.border,
                borderRadius: radius.pill,
                opacity: priceNum > 0 && priceNum <= PRICE_STEP ? 0.4 : 1,
              },
            ]}
          >
            <Ionicons name="remove" size={22} color={colors.primary} />
          </Pressable>

          <View style={{ width: 150, marginHorizontal: spacing.sm }}>
            <Input
              value={price}
              onChangeText={(t) => {
                setPriceTouched(true);
                setPrice(t.replace(/[^0-9]/g, ""));
              }}
              placeholder="e.g. 100"
              keyboardType="number-pad"
              maxLength={5}
              iconLeft={
                <Text
                  style={{
                    color: priceNum > 0 ? priceToneColor : colors.textSecondary,
                    fontFamily: typography.fonts.bodySemi,
                    fontSize: typography.sizes.md,
                  }}
                >
                  ₹
                </Text>
              }
            />
          </View>

          <Pressable
            onPress={() => changePrice(PRICE_STEP)}
            accessibilityRole="button"
            accessibilityLabel="Increase price"
            style={({ pressed }) => [
              styles.stepBtn,
              {
                backgroundColor: pressed ? colors.primaryLight : colors.surfaceAlt,
                borderColor: colors.border,
                borderRadius: radius.pill,
              },
            ]}
          >
            <Ionicons name="add" size={22} color={colors.primary} />
          </Pressable>
        </View>

        {/* Colored market-rate feedback */}
        <View style={[styles.priceHint, { marginTop: spacing.md }]}>
          <Ionicons
            name={
              priceStatus.tone === "good"
                ? "checkmark-circle"
                : priceStatus.tone === "high"
                ? "trending-up"
                : priceStatus.tone === "low"
                ? "trending-down"
                : "pricetag-outline"
            }
            size={16}
            color={priceToneColor}
          />
          <Text
            style={{
              flex: 1,
              marginLeft: spacing.sm,
              color: priceToneColor,
              fontFamily: typography.fonts.bodyMedium,
              fontSize: typography.sizes.xs,
              lineHeight: 17,
            }}
          >
            {priceStatus.message}
          </Text>
          {recommendedPrice != null && priceNum !== recommendedPrice ? (
            <Pressable
              onPress={useSuggestedPrice}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Use suggested price ₹${recommendedPrice}`}
              style={({ pressed }) => [
                styles.useSuggested,
                {
                  backgroundColor: colors.primaryLight,
                  borderRadius: radius.pill,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: typography.fonts.bodySemi,
                  fontSize: typography.sizes.xs,
                }}
              >
                Use ₹{recommendedPrice}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Card>

      {/* Optional details */}
      <Card elevated style={{ marginBottom: spacing.lg }}>
        <View style={styles.sectionHead}>
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
          label="Additional name for the parking"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Behind Sharma Sweets, blue gate"
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
        Location, what fits, how many and price per day are required. You can
        add photos, timings and more after publishing.
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
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  priceHint: {
    flexDirection: "row",
    alignItems: "center",
  },
  useSuggested: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
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
