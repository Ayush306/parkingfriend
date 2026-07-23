import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { MotiView } from "moti";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/theme/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { KeyboardAvoider } from "@/components/ui/KeyboardAvoider";
import { haptics } from "@/utils/haptics";

export default function Login() {
  const navigation = useNavigation<any>();
  const { colors, spacing, radius, typography } = useTheme();
  const { sendOtp } = useAuth();
  const toast = useToast();

  // Full international number, digits with an optional leading "+" — this
  // app has hosts and drivers everywhere, so no country/dial-code is assumed.
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  // Same 8–15 digit rule the server itself validates against (see
  // server/src/routes/auth.js normalizePhone) — works for any country's
  // numbers, not just one.
  const digitCount = useMemo(() => phone.replace(/\D/g, "").length, [phone]);
  const isValid = digitCount >= 8 && digitCount <= 15;
  const showError = touched && phone.length > 0 && !isValid;

  const handleChange = useCallback((text: string) => {
    // Keep digits, and a single leading "+" if the user typed a country code.
    const cleaned = text.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
    setPhone(cleaned.slice(0, 16));
  }, []);

  const handleSendOtp = useCallback(async () => {
    setTouched(true);
    if (!isValid) {
      haptics.warning();
      toast.show(
        "Enter your phone number with country code (e.g. +1 415 555 0123).",
        "warning"
      );
      return;
    }
    const fullPhone = phone.startsWith("+") ? phone : `+${phone}`;
    try {
      setLoading(true);
      await sendOtp(fullPhone);
      toast.show("OTP sent successfully", "success");
      navigation.navigate("OtpVerification", { phone: fullPhone, mode: "login" });
    } catch {
      toast.show("Something went wrong. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }, [isValid, phone, sendOtp, toast, navigation]);

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.root, { backgroundColor: colors.bg }]}
    >
      <Header showBack onBack={() => navigation.goBack()} />

      <KeyboardAvoider style={styles.flex}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 500 }}
          >
            <View
              style={[
                styles.iconBadge,
                {
                  backgroundColor: colors.primaryLight,
                  borderRadius: radius.lg,
                },
              ]}
            >
              <Ionicons
                name="phone-portrait-outline"
                size={28}
                color={colors.primary}
              />
            </View>

            <Text
              style={{
                marginTop: spacing.xl,
                fontFamily: typography.fonts.headingBold,
                fontSize: typography.sizes.xxl,
                color: colors.text,
              }}
            >
              Enter your mobile number
            </Text>
            <Text
              style={{
                marginTop: spacing.sm,
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.md,
                color: colors.textSecondary,
                lineHeight: typography.sizes.md * 1.5,
              }}
            >
              We'll send a 6-digit code to verify it's really you.
            </Text>
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 500, delay: 120 }}
            style={{ marginTop: spacing.xxxl }}
          >
            <Text
              style={{
                marginBottom: spacing.xs + 2,
                fontFamily: typography.fonts.bodyMedium,
                fontSize: typography.sizes.sm,
                color: colors.textSecondary,
              }}
            >
              Mobile number
            </Text>

            <Input
              value={phone}
              onChangeText={handleChange}
              placeholder="+1 415 555 0123"
              keyboardType="phone-pad"
              maxLength={16}
              autoFocus
              error={
                showError
                  ? "Enter your number with country code (8–15 digits)"
                  : undefined
              }
              iconLeft={
                <Text
                  style={{
                    fontFamily: typography.fonts.bodySemi,
                    fontSize: typography.sizes.md,
                    color: colors.textSecondary,
                  }}
                >
                  +
                </Text>
              }
              right={
                isValid ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.success}
                  />
                ) : undefined
              }
            />

            <View style={[styles.hintRow, { marginTop: spacing.md }]}>
              <Ionicons
                name="lock-closed-outline"
                size={14}
                color={colors.textMuted}
              />
              <Text
                style={{
                  marginLeft: spacing.xs + 2,
                  fontFamily: typography.fonts.body,
                  fontSize: typography.sizes.xs,
                  color: colors.textMuted,
                  flex: 1,
                }}
              >
                Your number is safe with us and never shared with hosts.
              </Text>
            </View>
          </MotiView>
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingHorizontal: spacing.xl,
              paddingBottom: spacing.md,
              backgroundColor: colors.bg,
            },
          ]}
        >
          <Button
            label="Send OTP"
            variant="gradient"
            size="lg"
            fullWidth
            loading={loading}
            disabled={!isValid}
            onPress={handleSendOtp}
            iconRight={
              !loading ? (
                <Ionicons name="arrow-forward" size={18} color={colors.white} />
              ) : undefined
            }
          />
        </View>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 24,
  },
  iconBadge: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  footer: {
    paddingTop: 8,
  },
});
