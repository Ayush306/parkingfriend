import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/theme/ThemeContext";
import { useToast } from "@/components/ui/Toast";
import { APP_NAME, COMPANY } from "@/constants";

interface Section {
  heading: string;
  body: string;
}

const LAST_UPDATED = "1 June 2026";

const TERMS: Section[] = [
  {
    heading: "1. Acceptance of terms",
    body: `By creating an account or using ${APP_NAME}, you agree to these Terms of Service and our Privacy Policy. If you do not agree, please do not use the app. These terms form a binding agreement between you and ${COMPANY.name}.`,
  },
  {
    heading: "2. Using the marketplace",
    body: `${APP_NAME} is a marketplace that connects drivers looking for parking with hosts who list their available space. We are not a party to the actual parking arrangement; hosts and drivers transact directly through the platform. You must be at least 18 years old to use ${APP_NAME}.`,
  },
  {
    heading: "3. Requests and settling payment",
    body: `${APP_NAME} does not process payments, hold funds, or charge either party a fee. When you request a spot, the host may accept or decline. Once accepted, each side's phone number is shared so you can coordinate directly. Any price is agreed and settled directly between host and driver — in cash, UPI or any method you both prefer — entirely outside the app.`,
  },
  {
    heading: "4. Cancellations",
    body: "You may withdraw a pending request at any time before the host accepts, at no cost. Once a host has accepted, please contact them directly if your plans change. Since no payment is processed through the app, there is nothing to refund on our end — any reimbursement for a cancelled arrangement is a matter between host and driver.",
  },
  {
    heading: "5. Host responsibilities",
    body: "Hosts must provide accurate listing details, keep availability up to date, and ensure the space is safe and accessible for the booked duration. Hosts are responsible for compliance with local society rules, municipal regulations and any applicable permissions.",
  },
  {
    heading: "6. Prohibited conduct",
    body: "You agree not to misuse the platform, including creating fraudulent listings, harassing other users, sharing another person's shared contact details for anything other than arranging the booking, or using a spot for anything other than lawful parking of the declared vehicle. Violations may result in suspension or permanent removal.",
  },
  {
    heading: "7. Limitation of liability",
    body: `${COMPANY.name} is not liable for damage, theft or loss occurring at a parking spot, which remains between the host and driver. Our total liability for any claim is limited to the value of the affected booking. Nothing in these terms excludes liability that cannot be excluded under Indian law.`,
  },
  {
    heading: "8. Changes to these terms",
    body: "We may update these terms from time to time. Material changes will be notified in the app. Continued use after an update constitutes acceptance of the revised terms.",
  },
];

const PRIVACY: Section[] = [
  {
    heading: "1. Information we collect",
    body: "We collect the information you provide when you register — such as your name, phone number and email — along with your booking/request history and vehicle details you add. We also collect device and usage information to keep the app secure and improve your experience.",
  },
  {
    heading: "2. How we use your data",
    body: `We use your information to create and manage requests and listings, connect you with hosts or drivers, send booking and safety notifications, provide support, and improve ${APP_NAME}. We do not sell your personal data.`,
  },
  {
    heading: "3. Location information",
    body: "With your permission, we use your location to show nearby parking spots and give accurate directions. You can disable location access at any time from your device settings; some features may then be limited.",
  },
  {
    heading: "4. Sharing with hosts and drivers",
    body: "To complete a booking, we share limited details between the driver and host — such as name, vehicle type and a contact number once a booking is confirmed. We share only what is needed to make the parking arrangement work.",
  },
  {
    heading: "5. No payment processing",
    body: `${APP_NAME} never processes, stores or has access to any payment or card information. Every price is settled directly between host and driver, outside the app, in whatever way you both agree.`,
  },
  {
    heading: "6. Data retention",
    body: "We keep your data for as long as your account is active and as required to meet legal, tax and dispute-resolution obligations. You can request deletion of your account and associated personal data at any time.",
  },
  {
    heading: "7. Your rights",
    body: "You may access, correct or delete your personal information from within the app or by contacting support. You may also opt out of promotional communications while still receiving essential booking notifications.",
  },
  {
    heading: "8. Contact",
    body: `For any privacy questions or requests, reach us through the Help & Support screen or write to our team at ${COMPANY.address}.`,
  },
];

const TAB_TERMS = "Terms";
const TAB_PRIVACY = "Privacy";

export default function TermsPrivacy() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const toast = useToast();
  const { colors, spacing, typography, radius } = useTheme();

  const initial =
    (route.params as any)?.tab === "privacy" ? TAB_PRIVACY : TAB_TERMS;
  const [tab, setTab] = useState<string>(initial);

  const sections = useMemo(
    () => (tab === TAB_TERMS ? TERMS : PRIVACY),
    [tab]
  );

  const handleUnderstand = () => {
    toast.show(
      `Thanks for reviewing our ${
        tab === TAB_TERMS ? "Terms" : "Privacy Policy"
      }.`,
      "success"
    );
    navigation.goBack();
  };

  return (
    <Screen scroll padded>
      <Header
        showBack
        title="Terms & Privacy"
        onBack={() => navigation.goBack()}
      />

      <SegmentedControl
        options={[TAB_TERMS, TAB_PRIVACY]}
        value={tab}
        onChange={setTab}
      />

      <View
        style={[
          styles.metaRow,
          { marginTop: spacing.lg, marginBottom: spacing.md },
        ]}
      >
        <Ionicons
          name="document-text-outline"
          size={16}
          color={colors.textMuted}
        />
        <Text
          style={{
            marginLeft: spacing.xs + 2,
            color: colors.textMuted,
            fontFamily: typography.fonts.body,
            fontSize: typography.sizes.sm,
          }}
        >
          Last updated {LAST_UPDATED}
        </Text>
      </View>

      <MotiView
        key={tab}
        from={{ opacity: 0, translateX: 12 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: "timing", duration: 260 }}
      >
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderColor: colors.border,
                padding: spacing.lg,
              },
            ]}
          >
            <Text
              style={{
                color: colors.text,
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.md,
                lineHeight: 23,
                marginBottom: spacing.lg,
              }}
            >
              {tab === TAB_TERMS
                ? `Please read these terms carefully before using ${APP_NAME}.`
                : `Your privacy matters to us. This policy explains how ${APP_NAME} handles your data.`}
            </Text>

            {sections.map((s, i) => (
              <View
                key={s.heading}
                style={{
                  marginBottom: i === sections.length - 1 ? 0 : spacing.lg,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontFamily: typography.fonts.bodySemi,
                    fontSize: typography.sizes.md,
                    marginBottom: spacing.xs,
                  }}
                >
                  {s.heading}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: typography.fonts.body,
                    fontSize: typography.sizes.md,
                    lineHeight: 23,
                  }}
                >
                  {s.body}
                </Text>
              </View>
            ))}
          </View>
        </MotiView>

      <Button
        label="I understand"
        variant="gradient"
        fullWidth
        onPress={handleUnderstand}
        iconRight={
          <Ionicons name="checkmark-circle" size={18} color={colors.white} />
        }
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
