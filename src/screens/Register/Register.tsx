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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const navigation = useNavigation<any>();
  const { colors, spacing, radius, typography } = useTheme();
  const { sendOtp } = useAuth();
  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const nameOk = name.trim().length >= 2;
  const digitCount = useMemo(() => phone.replace(/\D/g, "").length, [phone]);
  const phoneOk = digitCount >= 8 && digitCount <= 15;
  const emailOk = email.trim().length === 0 || EMAIL_RE.test(email.trim());
  const canSubmit = nameOk && phoneOk && emailOk;

  const onPhoneChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
    setPhone(cleaned.slice(0, 16));
  }, []);

  const handleContinue = useCallback(async () => {
    setTouched(true);
    if (!canSubmit) {
      haptics.warning();
      if (!nameOk) toast.show("Please enter your name.", "warning");
      else if (!emailOk) toast.show("Enter a valid email, or leave it blank.", "warning");
      else toast.show("Enter your number with country code.", "warning");
      return;
    }
    const fullPhone = phone.startsWith("+") ? phone : `+${phone}`;
    try {
      setLoading(true);
      await sendOtp(fullPhone);
      toast.show("OTP sent successfully", "success");
      navigation.navigate("OtpVerification", {
        phone: fullPhone,
        name: name.trim(),
        email: email.trim() || undefined,
        mode: "register",
      });
    } catch {
      toast.show("Something went wrong. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }, [canSubmit, nameOk, emailOk, phone, name, email, sendOtp, toast, navigation]);

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.root, { backgroundColor: colors.bg }]}
    >
      <Header showBack onBack={() => navigation.goBack()} />

      <KeyboardAvoider style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingHorizontal: spacing.xl }]}
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
                { backgroundColor: colors.primaryLight, borderRadius: radius.lg },
              ]}
            >
              <Ionicons name="person-add-outline" size={28} color={colors.primary} />
            </View>

            <Text
              style={{
                marginTop: spacing.xl,
                fontFamily: typography.fonts.headingBold,
                fontSize: typography.sizes.xxl,
                color: colors.text,
              }}
            >
              Create your account
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
              A few details and a quick code — that's all it takes.
            </Text>
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 500, delay: 120 }}
            style={{ marginTop: spacing.xxl }}
          >
            <Input
              label="Full name"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoFocus
              error={touched && !nameOk ? "Please enter your name" : undefined}
              iconLeft={
                <Ionicons name="person-outline" size={20} color={colors.textMuted} />
              }
            />

            <View style={{ height: spacing.lg }} />
            <Input
              label="Email (optional)"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              error={touched && !emailOk ? "Enter a valid email address" : undefined}
              iconLeft={
                <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
              }
            />

            <View style={{ height: spacing.lg }} />
            <Input
              label="Mobile number"
              value={phone}
              onChangeText={onPhoneChange}
              placeholder="+1 415 555 0123"
              keyboardType="phone-pad"
              maxLength={16}
              error={
                touched && !phoneOk
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
            />

            <View style={[styles.hintRow, { marginTop: spacing.md }]}>
              <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
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
            label="Create account"
            variant="gradient"
            size="lg"
            fullWidth
            loading={loading}
            disabled={!canSubmit}
            onPress={handleContinue}
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
  root: { flex: 1 },
  flex: { flex: 1 },
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
