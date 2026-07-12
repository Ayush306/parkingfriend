import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from "react-native";
import { MotiView } from "moti";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/theme/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Header } from "@/components/ui/Header";
import { OtpInput } from "@/components/ui/OtpInput";
import { Button } from "@/components/ui/Button";
import { haptics } from "@/utils/haptics";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function OtpVerification() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params as any) ?? {};
  const phone: string = params.phone ?? "your number";
  const name: string | undefined = params.name;
  const email: string | undefined = params.email;
  const isRegister: boolean = params.mode === "register";

  const { colors, spacing, radius, typography } = useTheme();
  const { verifyOtp, sendOtp } = useAuth();
  const toast = useToast();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counter, setCounter] = useState(RESEND_SECONDS);

  // Guard against double-submits when auto-verify + manual press race.
  const submitting = useRef(false);

  const canResend = counter <= 0;
  const isComplete = code.length === OTP_LENGTH;

  // Resend countdown.
  useEffect(() => {
    if (counter <= 0) return;
    const id = setInterval(() => {
      setCounter((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [counter]);

  const timerLabel = useMemo(() => {
    const m = Math.floor(counter / 60);
    const s = counter % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [counter]);

  const handleVerify = useCallback(
    async (value: string) => {
      if (submitting.current) return;
      if (value.length !== OTP_LENGTH) {
        setError("Please enter the full 6-digit code");
        haptics.warning();
        return;
      }
      submitting.current = true;
      setError(null);
      try {
        setLoading(true);
        await verifyOtp(
          phone,
          value,
          isRegister ? { name, email } : undefined
        );
        haptics.success();
        toast.show(isRegister ? "Welcome to ParkingFriend!" : "Verified successfully", "success");
        navigation.reset({ index: 0, routes: [{ name: "Main" }] });
      } catch (e: any) {
        haptics.error();
        setCode("");
        const msg = e?.message ?? "Invalid code. Please try again.";
        setError(msg);
        toast.show(msg, "error");
        // Logging in with a number that was never registered → send them
        // to the Register screen (their entered number carries over).
        if (!isRegister && /no account/i.test(msg)) {
          setTimeout(() => navigation.replace("Register"), 900);
        }
      } finally {
        setLoading(false);
        submitting.current = false;
      }
    },
    [phone, verifyOtp, toast, navigation, isRegister, name, email]
  );

  const handleChange = useCallback((value: string) => {
    setCode(value);
    setError(null);
  }, []);

  const handleResend = useCallback(async () => {
    if (!canResend) return;
    try {
      haptics.light();
      setCode("");
      setError(null);
      await sendOtp(phone);
      setCounter(RESEND_SECONDS);
      toast.show("A new code is on its way", "success");
    } catch {
      toast.show("Couldn't resend the code. Try again.", "error");
    }
  }, [canResend, phone, sendOtp, toast]);

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.root, { backgroundColor: colors.bg }]}
    >
      <Header showBack onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
                name="chatbubble-ellipses-outline"
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
              Verify your number
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
              Enter the 6-digit code we sent to{" "}
              <Text
                style={{
                  fontFamily: typography.fonts.bodySemi,
                  color: colors.text,
                }}
              >
                {phone}
              </Text>
            </Text>
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 500, delay: 120 }}
            style={{ marginTop: spacing.xxxl }}
          >
            <OtpInput
              length={OTP_LENGTH}
              value={code}
              onChange={handleChange}
              onComplete={handleVerify}
            />

            {error ? (
              <MotiView
                from={{ opacity: 0, translateX: -6 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: "timing", duration: 250 }}
                style={[styles.errorRow, { marginTop: spacing.md }]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={16}
                  color={colors.error}
                />
                <Text
                  style={{
                    marginLeft: spacing.xs + 2,
                    fontFamily: typography.fonts.bodyMedium,
                    fontSize: typography.sizes.sm,
                    color: colors.error,
                  }}
                >
                  {error}
                </Text>
              </MotiView>
            ) : null}
          </MotiView>

          {/* Resend */}
          <View style={[styles.resendRow, { marginTop: spacing.xxl }]}>
            <Text
              style={{
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.sm,
                color: colors.textSecondary,
              }}
            >
              Didn't get the code?
            </Text>
            {canResend ? (
              <Pressable
                onPress={handleResend}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Resend code"
              >
                <Text
                  style={{
                    marginLeft: spacing.xs + 2,
                    fontFamily: typography.fonts.bodySemi,
                    fontSize: typography.sizes.sm,
                    color: colors.primary,
                  }}
                >
                  Resend now
                </Text>
              </Pressable>
            ) : (
              <Text
                style={{
                  marginLeft: spacing.xs + 2,
                  fontFamily: typography.fonts.bodySemi,
                  fontSize: typography.sizes.sm,
                  color: colors.textMuted,
                }}
              >
                Resend in {timerLabel}
              </Text>
            )}
          </View>

          <View style={[styles.demoHint, { marginTop: spacing.lg }]}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color={colors.textMuted}
            />
            <Text
              style={{
                marginLeft: spacing.xs + 2,
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.xs,
                color: colors.textMuted,
              }}
            >
              Demo: use 123456 (or any 6 digits) to continue.
            </Text>
          </View>
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
            label="Verify & continue"
            variant="gradient"
            size="lg"
            fullWidth
            loading={loading}
            disabled={!isComplete}
            onPress={() => handleVerify(code)}
          />
        </View>
      </KeyboardAvoidingView>
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
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  demoHint: {
    flexDirection: "row",
    alignItems: "center",
  },
  footer: {
    paddingTop: 8,
  },
});
