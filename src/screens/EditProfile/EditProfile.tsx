import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import { useTheme } from "@/theme/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { userService } from "@/services/userService";
import { haptics } from "@/utils/haptics";
import type { User } from "@/models/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Cap on the stored avatar data URI (~600KB of base64) so it stays small
 *  enough to live on the user row and travel with every listing's host. */
const MAX_AVATAR_CHARS = 800000;

export default function EditProfile() {
  const navigation = useNavigation<any>();
  const { colors, spacing, typography, radius, shadows } = useTheme();
  const { updateUser } = useAuth();
  const toast = useToast();

  const { data: profile, loading } = useAsync<User>(
    () => userService.getProfile(),
    []
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [nameErr, setNameErr] = useState<string | undefined>();
  const [emailErr, setEmailErr] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Seed the form once the profile resolves.
  useEffect(() => {
    if (profile && !hydrated) {
      setName(profile.name ?? "");
      setEmail(profile.email ?? "");
      setPhone(profile.phone ?? "");
      setAvatar(profile.avatar);
      setHydrated(true);
    }
  }, [profile, hydrated]);

  const dirty = useMemo(() => {
    if (!profile) return false;
    return (
      name.trim() !== (profile.name ?? "") ||
      email.trim() !== (profile.email ?? "") ||
      avatar !== profile.avatar
    );
  }, [profile, name, email, avatar]);

  // Pick a real profile photo from the device. Stored as a compact base64
  // data URI so every user who sees this host's listing sees the photo too.
  const pickImage = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.show("Photo permission is needed to choose an image.", "warning");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.35,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const dataUri = asset.base64
        ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
        : asset.uri;
      if (dataUri && dataUri.length > MAX_AVATAR_CHARS) {
        toast.show("That image is a bit large — please pick a smaller one.", "warning");
        return;
      }
      haptics.selection();
      setAvatar(dataUri);
    } catch {
      toast.show("Couldn't open your photos. Please try again.", "error");
    }
  }, [toast]);

  const validate = useCallback(() => {
    let ok = true;
    if (name.trim().length < 2) {
      setNameErr("Please enter your full name");
      ok = false;
    } else {
      setNameErr(undefined);
    }
    if (email.trim().length > 0 && !EMAIL_RE.test(email.trim())) {
      setEmailErr("Enter a valid email address");
      ok = false;
    } else {
      setEmailErr(undefined);
    }
    return ok;
  }, [name, email]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    if (!validate()) {
      haptics.warning();
      return;
    }
    setSaving(true);
    try {
      const patch: Partial<User> = {
        name: name.trim(),
        email: email.trim() || undefined,
        avatar,
      };
      const updated = await userService.updateProfile(patch);
      updateUser(patch);
      haptics.success();
      toast.show("Profile updated", "success");
      // Let the toast breathe before popping back.
      setTimeout(() => navigation.goBack(), 350);
      void updated;
    } catch {
      setSaving(false);
      haptics.error();
      toast.show("Couldn't save changes. Please try again.", "error");
    }
  }, [saving, validate, name, email, avatar, updateUser, toast, navigation]);

  return (
    <Screen scroll padded>
      <Header title="Edit profile" showBack onBack={() => navigation.goBack()} />

      {/* Avatar block */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 360 }}
        style={styles.avatarBlock}
      >
        <View style={styles.avatarWrap}>
          {loading && !hydrated ? (
            <Skeleton width={104} height={104} radius={radius.pill} />
          ) : (
            <Avatar uri={avatar} name={name || profile?.name} size={104} />
          )}
          <Pressable
            onPress={pickImage}
            accessibilityRole="button"
            accessibilityLabel="Change avatar"
            style={({ pressed }) => [
              styles.cameraBtn,
              {
                backgroundColor: colors.primary,
                borderColor: colors.bg,
                borderRadius: radius.pill,
                transform: [{ scale: pressed ? 0.9 : 1 }],
                ...shadows.md,
              },
            ]}
          >
            <Ionicons name="camera" size={18} color={colors.white} />
          </Pressable>
        </View>
        <Pressable onPress={pickImage} hitSlop={8}>
          <Text
            style={{
              marginTop: spacing.md,
              fontFamily: typography.fonts.bodySemi,
              fontSize: typography.sizes.sm,
              color: colors.primary,
            }}
          >
            Tap to change photo
          </Text>
        </Pressable>
      </MotiView>

      {/* Keyboard avoidance is handled by the parent <Screen scroll>. */}
      <View>
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 400, delay: 80 }}
        >
          <View style={{ marginTop: spacing.xl }}>
            <Input
              label="Full name"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              error={nameErr}
              iconLeft={
                <Ionicons name="person-outline" size={20} color={colors.textMuted} />
              }
            />
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              error={emailErr}
              iconLeft={
                <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
              }
            />
          </View>

          {/* Phone (read-only) */}
          <View style={{ marginTop: spacing.lg }}>
            <Text
              style={{
                fontFamily: typography.fonts.bodyMedium,
                fontSize: typography.sizes.sm,
                color: colors.textSecondary,
                marginBottom: spacing.xs + 2,
              }}
            >
              Phone number
            </Text>
            <View
              style={[
                styles.readonlyField,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                },
              ]}
            >
              <Ionicons name="call-outline" size={20} color={colors.textMuted} />
              <Text
                style={{
                  flex: 1,
                  marginLeft: 10,
                  fontFamily: typography.fonts.body,
                  fontSize: typography.sizes.md,
                  color: colors.textSecondary,
                }}
              >
                {phone || "—"}
              </Text>
              <Badge label="Verified" tone="success" size="sm" />
            </View>
            <Text
              style={{
                marginTop: spacing.xs,
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.xs,
                color: colors.textMuted,
              }}
            >
              Your number is verified and can't be changed here.
            </Text>
          </View>
        </MotiView>
      </View>

      <View style={{ marginTop: spacing.xxl }}>
        <Button
          label="Save changes"
          variant="gradient"
          size="lg"
          fullWidth
          loading={saving}
          disabled={!dirty || loading}
          onPress={handleSave}
          iconLeft={
            !saving ? (
              <Ionicons name="checkmark" size={20} color={colors.white} />
            ) : undefined
          }
        />
        <Button
          label="Cancel"
          variant="ghost"
          size="md"
          fullWidth
          style={{ marginTop: spacing.sm }}
          onPress={() => navigation.goBack()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarBlock: {
    alignItems: "center",
    marginTop: 8,
  },
  avatarWrap: {
    position: "relative",
  },
  cameraBtn: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
  },
  readonlyField: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderWidth: 1,
  },
});
