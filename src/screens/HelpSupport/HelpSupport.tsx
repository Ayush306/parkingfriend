import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { MotiView } from "moti";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { Card } from "@/components/ui/Card";
import { SkeletonList } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SearchEmpty } from "@/components/illustrations/SearchEmpty";
import { useTheme } from "@/theme/ThemeContext";
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { haptics } from "@/utils/haptics";
import type { Faq } from "@/models/types";
import faqsData from "@/data/faqs.json";
import { delay, randomLatency } from "@/services/mockClient";
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_WHATSAPP } from "@/constants";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

async function loadFaqs(): Promise<Faq[]> {
  await delay(randomLatency());
  return faqsData as Faq[];
}

const ALL = "All";

interface AccordionItemProps {
  faq: Faq;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}

function AccordionItem({ faq, index, expanded, onToggle }: AccordionItemProps) {
  const { colors, spacing, typography, radius } = useTheme();

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 320, delay: index * 45 }}
      style={{ marginBottom: spacing.md }}
    >
      <Card padded={false} elevated>
        <Pressable
          onPress={() => {
            haptics.light();
            LayoutAnimation.configureNext(
              LayoutAnimation.Presets.easeInEaseOut
            );
            onToggle();
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={faq.question}
          style={({ pressed }) => [
            styles.qRow,
            {
              padding: spacing.lg,
              backgroundColor: pressed ? colors.surfaceAlt : "transparent",
              borderRadius: radius.lg,
            },
          ]}
        >
          <Text
            style={{
              flex: 1,
              color: colors.text,
              fontFamily: typography.fonts.bodySemi,
              fontSize: typography.sizes.md,
              lineHeight: 22,
              marginRight: spacing.md,
            }}
          >
            {faq.question}
          </Text>
          <MotiView
            animate={{ rotate: expanded ? "180deg" : "0deg" }}
            transition={{ type: "timing", duration: 220 }}
            style={[
              styles.chevron,
              {
                backgroundColor: expanded
                  ? colors.primary
                  : colors.surfaceAlt,
                borderRadius: radius.pill,
              },
            ]}
          >
            <Ionicons
              name="chevron-down"
              size={16}
              color={expanded ? colors.white : colors.textSecondary}
            />
          </MotiView>
        </Pressable>

        {expanded ? (
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.lg,
            }}
          >
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: colors.border,
                marginBottom: spacing.md,
              }}
            />
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.md,
                lineHeight: 23,
              }}
            >
              {faq.answer}
            </Text>
          </View>
        ) : null}
      </Card>
    </MotiView>
  );
}

interface ContactCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tint: string;
  onPress: () => void;
  index: number;
}

function ContactCard({
  icon,
  title,
  subtitle,
  tint,
  onPress,
  index,
}: ContactCardProps) {
  const { colors, spacing, typography, radius } = useTheme();
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 320, delay: index * 60 }}
      style={{ flex: 1 }}
    >
      <Card onPress={onPress} padded={false} elevated style={{ flex: 1 }}>
        <View style={{ padding: spacing.md, alignItems: "center" }}>
          <View
            style={[
              styles.contactIcon,
              { backgroundColor: tint + "1A", borderRadius: radius.md },
            ]}
          >
            {icon}
          </View>
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fonts.bodySemi,
              fontSize: typography.sizes.sm,
              marginTop: spacing.sm,
            }}
          >
            {title}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: colors.textMuted,
              fontFamily: typography.fonts.body,
              fontSize: typography.sizes.xs,
              marginTop: 2,
              textAlign: "center",
            }}
          >
            {subtitle}
          </Text>
        </View>
      </Card>
    </MotiView>
  );
}

export default function HelpSupport() {
  const navigation = useNavigation<any>();
  const { colors, spacing, typography } = useTheme();

  const { data, loading, error, refetch } = useAsync<Faq[]>(loadFaqs, []);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const debounced = useDebounce(query, 300);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((f) => set.add(f.category));
    return [ALL, ...Array.from(set)];
  }, [data]);

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (category !== ALL) {
      list = list.filter((f) => f.category === category);
    }
    const q = debounced.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (f) =>
          f.question.toLowerCase().includes(q) ||
          f.answer.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, category, debounced]);

  const onRefresh = async () => {
    setRefreshing(true);
    setExpandedId(null);
    refetch();
    await delay(700);
    setRefreshing(false);
  };

  const openTel = () => Linking.openURL(`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`);
  const openMail = () =>
    Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
        "Parkmitter support"
      )}`
    );
  const openChat = () =>
    Linking.openURL(
      `https://wa.me/${SUPPORT_WHATSAPP.replace(/[^0-9]/g, "")}`
    ).catch(() => {});

  return (
    <Screen scroll padded refreshing={refreshing} onRefresh={onRefresh}>
      <Header showBack title="Help & Support" onBack={() => navigation.goBack()} />

      <Text
        style={{
          color: colors.textSecondary,
          fontFamily: typography.fonts.body,
          fontSize: typography.sizes.md,
          lineHeight: 22,
          marginBottom: spacing.lg,
        }}
      >
        Search our FAQs or reach the Parkmitter team any time.
      </Text>

      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search help articles"
        iconLeft={
          <Ionicons name="search" size={18} color={colors.textMuted} />
        }
        right={
          query.length ? (
            <Pressable
              onPress={() => setQuery("")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : undefined
        }
      />

      <View style={{ height: spacing.md }} />

      {/* Contact cards */}
      <View style={styles.contactRow}>
        <ContactCard
          index={0}
          icon={
            <Ionicons name="chatbubbles" size={20} color={colors.primary} />
          }
          title="Chat"
          subtitle="WhatsApp us"
          tint={colors.primary}
          onPress={openChat}
        />
        <View style={{ width: spacing.md }} />
        <ContactCard
          index={1}
          icon={<Feather name="phone-call" size={20} color={colors.secondary} />}
          title="Call"
          subtitle={SUPPORT_PHONE}
          tint={colors.secondary}
          onPress={openTel}
        />
        <View style={{ width: spacing.md }} />
        <ContactCard
          index={2}
          icon={<Feather name="mail" size={20} color={colors.accent} />}
          title="Email"
          subtitle="Write to us"
          tint={colors.accent}
          onPress={openMail}
        />
      </View>

      <View style={{ height: spacing.xl }} />

      <SectionHeader title="Frequently asked" />

      {/* Category chips */}
      {!loading && !error ? (
        <View style={styles.chips}>
          {categories.map((cat) => (
            <View
              key={cat}
              style={{ marginRight: spacing.sm, marginBottom: spacing.sm }}
            >
              <Chip
                label={cat}
                selected={category === cat}
                onPress={() => {
                  setCategory(cat);
                  setExpandedId(null);
                }}
              />
            </View>
          ))}
        </View>
      ) : null}

      {/* FAQ list states */}
      {loading ? (
        <SkeletonList count={4} card />
      ) : error ? (
        <ErrorState
          title="Couldn't load help"
          subtitle={error}
          onRetry={refetch}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          illustration={SearchEmpty}
          title="No results found"
          subtitle={`We couldn't find anything for "${debounced.trim()}". Try a different search or contact us.`}
          actionLabel="Contact support"
          onAction={openChat}
        />
      ) : (
        <View style={{ marginTop: spacing.sm }}>
          {filtered.map((faq, i) => (
            <AccordionItem
              key={faq.id}
              faq={faq}
              index={i}
              expanded={expandedId === faq.id}
              onToggle={() =>
                setExpandedId((prev) => (prev === faq.id ? null : faq.id))
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  qRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  chevron: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  contactIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 4,
  },
});
