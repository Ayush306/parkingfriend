import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
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
import { haptics } from "@/utils/haptics";

export default function Login() {
  const navigation = useNavigation<any>();
  const { colors, spacing, radius, typography } = useTheme();
  const { sendOtp } = useAuth();
  const toast = useToast();

  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const isValid = useMemo(() => /^[6-9]\d{9}$/.test(phone), [phone]);
  const showError = touched && phone.length > 0 && !isValid;

  const handleChange = useCallback((text: string) => {
    setPhone(text.replace(/[^0-9]/g, "").slice(0, 10));
  }, []);

  const handleSendOtp = useCallback(async () => {
    setTouched(true);
    if (!isValid) {
      haptics.warning();
      toast.show("Enter a valid 10-digit mobile number", "warning");
      return;
    }
    const fullPhone = `+91 ${phone}`;
    try {
      setLoading(true);
      await sendOtp(fullPhone);
      toast.show("OTP sent successfully", "success");
      navigation.navigate("OtpVerification", { phone: fullPhone });
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

            <View style={styles.phoneRow}>
              {/* +91 country prefix */}
              <View
                style={[
                  styles.prefix,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    marginRight: spacing.sm,
                  },
                ]}
              >
                <Text style={styles.flag}>🇮🇳</Text>
                <Text
                  style={{
                    fontFamily: typography.fonts.bodySemi,
                    fontSize: typography.sizes.md,
                    color: colors.text,
                  }}
                >
                  +91
                </Text>
              </View>

              <View style={styles.flex}>
                <Input
                  value={phone}
                  onChangeText={handleChange}
                  placeholder="98765 43210"
                  keyboardType="number-pad"
                  maxLength={10}
                  autoFocus
                  error={showError ? "Enter a valid 10-digit number" : undefined}
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
              </View>
            </View>

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
  phoneRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  prefix: {
    height: 52,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  flag: {
    fontSize: 18,
    marginRight: 6,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  footer: {
    paddingTop: 8,
  },
});
