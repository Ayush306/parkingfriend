import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Switch,
} from "react-native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SuccessCheck } from "@/components/illustrations/SuccessCheck";
import { useTheme } from "@/theme/ThemeContext";
import { useToast } from "@/components/ui/Toast";
import { haptics } from "@/utils/haptics";
import { formatCurrency, formatTime } from "@/utils/format";
import { hostService, type CreateListingPayload } from "@/services/hostService";
import { genId } from "@/services/mockClient";
import {
  STATIONS,
  SPOT_TYPE_OPTIONS,
  VEHICLE_OPTIONS,
  AMENITY_OPTIONS,
  type SpotTypeId,
  type VehicleId,
} from "@/constants";
import type { ParkingSpot } from "@/models/types";

const TIME_SLOTS = [
  "00:00",
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "12:00",
  "14:00",
  "18:00",
  "20:00",
  "22:00",
  "23:59",
];

type Errors = Partial<
  Record<
    | "title"
    | "type"
    | "vehicleTypes"
    | "address"
    | "area"
    | "station"
    | "price"
    | "photos",
    string
  >
>;

interface SectionCardProps {
  step: number;
  title: string;
  children: React.ReactNode;
  index: number;
}

function SectionCard({ step, title, children, index }: SectionCardProps) {
  const { colors, spacing, typography, radius } = useTheme();
  return (
    <MotiView
      from={{ opacity: 0, translateY: 14 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 340, delay: index * 60 }}
      style={{ marginBottom: spacing.lg }}
    >
      <Card elevated>
        <View style={[styles.sectionHead, { marginBottom: spacing.md }]}>
          <View
            style={[
              styles.stepDot,
              { backgroundColor: colors.primaryLight, borderRadius: radius.pill },
            ]}
          >
            <Text
              style={{
                color: colors.primary,
                fontFamily: typography.fonts.bodySemi,
                fontSize: typography.sizes.sm,
              }}
            >
              {step}
            </Text>
          </View>
          <Text
            style={{
              marginLeft: spacing.sm,
              color: colors.text,
              fontFamily: typography.fonts.heading,
              fontSize: typography.sizes.md,
            }}
          >
            {title}
          </Text>
        </View>
        {children}
      </Card>
    </MotiView>
  );
}

function FieldError({ message }: { message?: string }) {
  const { colors, typography, spacing } = useTheme();
  if (!message) return null;
  return (
    <View style={[styles.errRow, { marginTop: spacing.xs }]}>
      <Ionicons name="alert-circle" size={13} color={colors.error} />
      <Text
        style={{
          marginLeft: 4,
          color: colors.error,
          fontFamily: typography.fonts.body,
          fontSize: typography.sizes.xs,
        }}
      >
        {message}
      </Text>
    </View>
  );
}

export default function ListSpace() {
  const navigation = useNavigation<any>();
  const toast = useToast();
  const { colors, spacing, typography, radius, gradients } = useTheme();

  // form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState<SpotTypeId | null>(null);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleId[]>([]);
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [landmark, setLandmark] = useState("");
  const [station, setStation] = useState<string | null>(null);
  const [availableFrom, setAvailableFrom] = useState("08:00");
  const [availableTo, setAvailableTo] = useState("20:00");
  const [pickingFrom, setPickingFrom] = useState(false);
  const [pickingTo, setPickingTo] = useState(false);
  const [price, setPrice] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");

  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<ParkingSpot | null>(null);

  const clearErr = (key: keyof Errors) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const toggleVehicle = (id: VehicleId) => {
    haptics.selection();
    setVehicleTypes((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
    clearErr("vehicleTypes");
  };

  const toggleAmenity = (label: string) => {
    haptics.selection();
    setAmenities((prev) =>
      prev.includes(label)
        ? prev.filter((a) => a !== label)
        : [...prev, label]
    );
  };

  const addPhoto = () => {
    if (photos.length >= 6) {
      toast.show("You can add up to 6 photos.", "warning");
      return;
    }
    haptics.light();
    const seed = genId("photo");
    setPhotos((prev) => [
      ...prev,
      `https://picsum.photos/seed/pm-${seed}/800/520`,
    ]);
    clearErr("photos");
  };

  const removePhoto = (uri: string) => {
    haptics.light();
    setPhotos((prev) => prev.filter((p) => p !== uri));
  };

  const priceNumber = useMemo(() => {
    const n = parseInt(price.replace(/[^0-9]/g, ""), 10);
    return isNaN(n) ? 0 : n;
  }, [price]);

  const validate = (): boolean => {
    const next: Errors = {};
    if (title.trim().length < 4) {
      next.title = "Give your space a clear title (min 4 characters).";
    }
    if (!type) next.type = "Select a parking type.";
    if (vehicleTypes.length === 0) {
      next.vehicleTypes = "Pick at least one vehicle type.";
    }
    if (address.trim().length < 6) {
      next.address = "Enter the full address of your space.";
    }
    if (area.trim().length < 2) {
      next.area = "Enter the area or sector.";
    }
    if (!station) next.station = "Choose the nearest station.";
    if (!isFree && priceNumber <= 0) {
      next.price = "Enter a price per day, or offer it for free.";
    }
    if (photos.length === 0) {
      next.photos = "Add at least one photo of your space.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handlePublish = async () => {
    if (!validate()) {
      haptics.error();
      toast.show("Please fix the highlighted fields.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const perDay = isFree ? 0 : priceNumber;
      const payload: CreateListingPayload = {
        title: title.trim(),
        type: type as SpotTypeId,
        vehicleTypes,
        address: address.trim(),
        area: area.trim(),
        landmark: landmark.trim(),
        nearStation: station as string,
        pricePerHour: isFree ? 0 : Math.max(10, Math.round(perDay / 6)),
        pricePerDay: perDay,
        isFree,
        amenities,
        availableFrom,
        availableTo,
        instructions: instructions.trim(),
        images: photos,
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

  // ---- Success confirmation view ----
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
          <SuccessCheck size={170} color={colors.success} />
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
            "{created.title}" is now listed on Parkmitter. Drivers nearby can find
            and request it right away.
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
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.body,
                  fontSize: typography.sizes.sm,
                  marginTop: 2,
                }}
              >
                Near {created.nearStation}
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

  // ---- Form view ----
  return (
    <Screen scroll padded>
      <Header
        showBack
        title="List your space"
        subtitle="Earn from your empty parking"
        onBack={() => navigation.goBack()}
      />

      {/* 1. Basics */}
      <SectionCard step={1} title="The basics" index={0}>
        <Input
          label="Spot title"
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            clearErr("title");
          }}
          placeholder="e.g. Secure Driveway near Huda City Centre"
          maxLength={60}
          error={errors.title}
        />

        <Text style={[styles.fieldLabel, labelStyle(colors, typography, spacing)]}>
          Parking type
        </Text>
        <View style={styles.chipWrap}>
          {SPOT_TYPE_OPTIONS.map((opt) => (
            <View key={opt.id} style={styles.chipItem}>
              <Chip
                label={opt.label}
                selected={type === opt.id}
                onPress={() => {
                  setType(opt.id);
                  clearErr("type");
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
        <FieldError message={errors.type} />

        <Text style={[styles.fieldLabel, labelStyle(colors, typography, spacing)]}>
          Vehicle types accepted
        </Text>
        <View style={styles.chipWrap}>
          {VEHICLE_OPTIONS.map((opt) => {
            const selected = vehicleTypes.includes(opt.id);
            return (
              <View key={opt.id} style={styles.chipItem}>
                <Chip
                  label={opt.label}
                  selected={selected}
                  onPress={() => toggleVehicle(opt.id)}
                  icon={
                    <Ionicons
                      name={opt.icon as any}
                      size={15}
                      color={selected ? colors.white : colors.textSecondary}
                    />
                  }
                />
              </View>
            );
          })}
        </View>
        <FieldError message={errors.vehicleTypes} />
      </SectionCard>

      {/* 2. Location */}
      <SectionCard step={2} title="Location" index={1}>
        <Input
          label="Full address"
          value={address}
          onChangeText={(t) => {
            setAddress(t);
            clearErr("address");
          }}
          placeholder="House / tower, block, sector"
          iconLeft={<Ionicons name="location-outline" size={18} color={colors.textMuted} />}
          error={errors.address}
        />
        <View style={{ height: spacing.md }} />
        <Input
          label="Area / sector"
          value={area}
          onChangeText={(t) => {
            setArea(t);
            clearErr("area");
          }}
          placeholder="e.g. Sector 29"
          error={errors.area}
        />
        <View style={{ height: spacing.md }} />
        <Input
          label="Landmark (optional)"
          value={landmark}
          onChangeText={setLandmark}
          placeholder="e.g. Behind Leisure Valley Park"
        />

        <Text style={[styles.fieldLabel, labelStyle(colors, typography, spacing)]}>
          Nearest station
        </Text>
        <View style={styles.chipWrap}>
          {STATIONS.map((st) => (
            <View key={st} style={styles.chipItem}>
              <Chip
                label={st}
                selected={station === st}
                onPress={() => {
                  setStation(st);
                  clearErr("station");
                }}
              />
            </View>
          ))}
        </View>
        <FieldError message={errors.station} />
      </SectionCard>

      {/* 3. Availability */}
      <SectionCard step={3} title="Availability" index={2}>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.fonts.body,
            fontSize: typography.sizes.sm,
            marginBottom: spacing.md,
          }}
        >
          When is your space open for parking each day?
        </Text>
        <View style={styles.timeRow}>
          <TimeField
            label="Available from"
            value={availableFrom}
            open={pickingFrom}
            onToggle={() => {
              setPickingFrom((v) => !v);
              setPickingTo(false);
            }}
          />
          <View style={{ width: spacing.md }} />
          <TimeField
            label="Available to"
            value={availableTo}
            open={pickingTo}
            onToggle={() => {
              setPickingTo((v) => !v);
              setPickingFrom(false);
            }}
          />
        </View>

        {pickingFrom ? (
          <TimePicker
            value={availableFrom}
            onSelect={(v) => {
              setAvailableFrom(v);
              setPickingFrom(false);
            }}
          />
        ) : null}
        {pickingTo ? (
          <TimePicker
            value={availableTo}
            onSelect={(v) => {
              setAvailableTo(v);
              setPickingTo(false);
            }}
          />
        ) : null}
      </SectionCard>

      {/* 4. Pricing */}
      <SectionCard step={4} title="Pricing" index={3}>
        <View
          style={[
            styles.freeRow,
            {
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.md,
              padding: spacing.md,
              marginBottom: spacing.md,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.text,
                fontFamily: typography.fonts.bodySemi,
                fontSize: typography.sizes.md,
              }}
            >
              Offer for free
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.sm,
                marginTop: 1,
              }}
            >
              Great for building reviews fast
            </Text>
          </View>
          <Switch
            value={isFree}
            onValueChange={(v) => {
              haptics.selection();
              setIsFree(v);
              clearErr("price");
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        {!isFree ? (
          <>
            <Input
              label="Price per day"
              value={price}
              onChangeText={(t) => {
                setPrice(t.replace(/[^0-9]/g, ""));
                clearErr("price");
              }}
              placeholder="e.g. 220"
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
              error={errors.price}
            />
            {priceNumber > 0 ? (
              <Text
                style={{
                  color: colors.textMuted,
                  fontFamily: typography.fonts.body,
                  fontSize: typography.sizes.sm,
                  marginTop: spacing.xs,
                }}
              >
                Roughly {formatCurrency(Math.max(10, Math.round(priceNumber / 6)))}/hour ·
                you keep about {formatCurrency(Math.round(priceNumber * 0.85))} after fees
              </Text>
            ) : null}
          </>
        ) : (
          <View style={styles.freeNotice}>
            <Ionicons name="gift-outline" size={18} color={colors.primary} />
            <Text
              style={{
                marginLeft: spacing.sm,
                color: colors.textSecondary,
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.sm,
                flex: 1,
              }}
            >
              This space will be listed as free. You can add pricing later.
            </Text>
          </View>
        )}
      </SectionCard>

      {/* 5. Amenities */}
      <SectionCard step={5} title="Amenities" index={4}>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.fonts.body,
            fontSize: typography.sizes.sm,
            marginBottom: spacing.md,
          }}
        >
          Select everything your space offers.
        </Text>
        <View style={styles.chipWrap}>
          {AMENITY_OPTIONS.map((opt) => {
            const selected = amenities.includes(opt.label);
            return (
              <View key={opt.id} style={styles.chipItem}>
                <Chip
                  label={opt.label}
                  selected={selected}
                  onPress={() => toggleAmenity(opt.label)}
                  icon={
                    <Ionicons
                      name={opt.icon as any}
                      size={14}
                      color={selected ? colors.white : colors.textSecondary}
                    />
                  }
                />
              </View>
            );
          })}
        </View>
      </SectionCard>

      {/* 6. Photos */}
      <SectionCard step={6} title="Photos" index={5}>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.fonts.body,
            fontSize: typography.sizes.sm,
            marginBottom: spacing.md,
          }}
        >
          Add clear photos so drivers know exactly what to expect.
        </Text>
        <View style={styles.photoGrid}>
          {photos.map((uri) => (
            <MotiView
              key={uri}
              from={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "timing", duration: 260 }}
              style={styles.photoItem}
            >
              <Image
                source={{ uri }}
                style={[
                  styles.photo,
                  { backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
                ]}
              />
              <Pressable
                onPress={() => removePhoto(uri)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                style={[
                  styles.removeBtn,
                  { backgroundColor: colors.overlay, borderRadius: radius.pill },
                ]}
              >
                <Ionicons name="close" size={14} color={colors.white} />
              </Pressable>
            </MotiView>
          ))}

          {photos.length < 6 ? (
            <Pressable
              onPress={addPhoto}
              accessibilityRole="button"
              accessibilityLabel="Add photo"
              style={({ pressed }) => [
                styles.photoItem,
                styles.addPhoto,
                {
                  borderColor: colors.primary,
                  borderRadius: radius.md,
                  backgroundColor: colors.primaryLight,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="camera-outline" size={22} color={colors.primary} />
              <Text
                style={{
                  marginTop: 4,
                  color: colors.primary,
                  fontFamily: typography.fonts.bodyMedium,
                  fontSize: typography.sizes.xs,
                }}
              >
                Add photo
              </Text>
            </Pressable>
          ) : null}
        </View>
        <FieldError message={errors.photos} />
      </SectionCard>

      {/* 7. Instructions */}
      <SectionCard step={7} title="Arrival instructions" index={6}>
        <Input
          label="Instructions (optional)"
          value={instructions}
          onChangeText={setInstructions}
          placeholder="e.g. Ring the doorbell at gate C. Park nose-in on the left."
          multiline
          maxLength={240}
        />
        <Text
          style={{
            alignSelf: "flex-end",
            color: colors.textMuted,
            fontFamily: typography.fonts.body,
            fontSize: typography.sizes.xs,
            marginTop: spacing.xs,
          }}
        >
          {instructions.length}/240
        </Text>
      </SectionCard>

      <Button
        label="Publish space"
        variant="gradient"
        size="lg"
        fullWidth
        loading={submitting}
        onPress={handlePublish}
        iconRight={<Ionicons name="rocket-outline" size={18} color={colors.white} />}
        style={{ marginTop: spacing.sm }}
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
        By publishing you agree to Parkmitter's hosting guidelines. You can edit
        or unlist your space any time.
      </Text>
    </Screen>
  );
}

// ---- local sub-components ----

function labelStyle(colors: any, typography: any, spacing: any) {
  return {
    color: colors.textSecondary,
    fontFamily: typography.fonts.bodyMedium,
    fontSize: typography.sizes.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  };
}

interface TimeFieldProps {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
}

function TimeField({ label, value, open, onToggle }: TimeFieldProps) {
  const { colors, spacing, typography, radius } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          color: colors.textSecondary,
          fontFamily: typography.fonts.bodyMedium,
          fontSize: typography.sizes.sm,
          marginBottom: spacing.xs + 2,
        }}
      >
        {label}
      </Text>
      <Pressable
        onPress={() => {
          haptics.light();
          onToggle();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatTime(value)}`}
        style={({ pressed }) => [
          styles.timeField,
          {
            backgroundColor: colors.surface,
            borderColor: open ? colors.primary : colors.border,
            borderWidth: open ? 1.5 : 1,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Ionicons name="time-outline" size={18} color={colors.textMuted} />
        <Text
          style={{
            flex: 1,
            marginLeft: spacing.sm,
            color: colors.text,
            fontFamily: typography.fonts.bodyMedium,
            fontSize: typography.sizes.md,
          }}
        >
          {formatTime(value)}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.textMuted}
        />
      </Pressable>
    </View>
  );
}

interface TimePickerProps {
  value: string;
  onSelect: (value: string) => void;
}

function TimePicker({ value, onSelect }: TimePickerProps) {
  const { colors, spacing, typography, radius } = useTheme();
  return (
    <MotiView
      from={{ opacity: 0, translateY: -6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 220 }}
      style={[
        styles.pickerWrap,
        {
          marginTop: spacing.md,
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.md,
          padding: spacing.sm,
        },
      ]}
    >
      {TIME_SLOTS.map((slot) => {
        const active = slot === value;
        return (
          <Pressable
            key={slot}
            onPress={() => {
              haptics.selection();
              onSelect(slot);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={formatTime(slot)}
            style={[
              styles.slot,
              {
                backgroundColor: active ? colors.primary : colors.surface,
                borderRadius: radius.pill,
                margin: 4,
              },
            ]}
          >
            <Text
              style={{
                color: active ? colors.white : colors.textSecondary,
                fontFamily: typography.fonts.bodyMedium,
                fontSize: typography.sizes.sm,
              }}
            >
              {formatTime(slot)}
            </Text>
          </Pressable>
        );
      })}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepDot: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: {},
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  chipItem: {
    marginRight: 8,
    marginBottom: 8,
  },
  errRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  timeField: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
  },
  pickerWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  slot: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  freeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  freeNotice: {
    flexDirection: "row",
    alignItems: "center",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  photoItem: {
    width: 96,
    height: 96,
    marginRight: 10,
    marginBottom: 10,
  },
  photo: {
    width: 96,
    height: 96,
  },
  removeBtn: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  addPhoto: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderStyle: "dashed",
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
