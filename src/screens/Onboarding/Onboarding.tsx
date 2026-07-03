import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  Pressable,
  ViewToken,
  StatusBar,
} from "react-native";
import { MotiView } from "moti";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import {
  ParkingHero,
  SearchEmpty,
  SuccessCheck,
  type IllustrationProps,
} from "@/components/illustrations";
import { haptics } from "@/utils/haptics";
import onboardingData from "@/data/onboarding.json";
import type { OnboardingSlide } from "@/models/types";

const SLIDES = onboardingData as OnboardingSlide[];

// Map the slide's illustration key to a concrete SVG illustration component.
const ILLUSTRATIONS: Record<
  string,
  React.FC<IllustrationProps>
> = {
  search: SearchEmpty,
  book: ParkingHero,
  friend: SuccessCheck,
};

export default function Onboarding() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const { colors, spacing, typography } = useTheme();
  const { completeOnboarding } = useAuth();

  const listRef = useRef<FlatList<OnboardingSlide>>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) setIndex(first.index);
    }
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const finish = useCallback(async () => {
    haptics.success();
    await completeOnboarding();
    navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
  }, [completeOnboarding, navigation]);

  const handleNext = useCallback(() => {
    if (isLast) {
      void finish();
      return;
    }
    const next = index + 1;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  }, [index, isLast, finish]);

  const handleSkip = useCallback(() => {
    void finish();
  }, [finish]);

  const renderItem = useCallback(
    ({ item }: { item: OnboardingSlide }) => {
      const Illustration = ILLUSTRATIONS[item.illustration] ?? ParkingHero;
      return (
        <View style={[styles.slide, { width, paddingHorizontal: spacing.xl }]}>
          <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 15, stiffness: 140 }}
            style={[
              styles.artWrap,
              { backgroundColor: colors.primaryLight },
            ]}
          >
            <Illustration size={220} color={colors.primary} />
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 18 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 500, delay: 120 }}
          >
            <Text
              style={{
                marginTop: spacing.huge,
                textAlign: "center",
                fontFamily: typography.fonts.headingBold,
                fontSize: typography.sizes.xxl,
                color: colors.text,
                lineHeight: typography.sizes.xxl * 1.25,
              }}
            >
              {item.title}
            </Text>
            <Text
              style={{
                marginTop: spacing.md,
                textAlign: "center",
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.md,
                color: colors.textSecondary,
                lineHeight: typography.sizes.md * 1.5,
                paddingHorizontal: spacing.sm,
              }}
            >
              {item.subtitle}
            </Text>
          </MotiView>
        </View>
      );
    },
    [width, colors, spacing, typography]
  );

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.root, { backgroundColor: colors.bg }]}
    >
      <StatusBar
        barStyle={colors.bg === "#F6F8FA" ? "dark-content" : "light-content"}
      />

      {/* Skip */}
      <View style={[styles.topBar, { paddingHorizontal: spacing.xl }]}>
        {!isLast ? (
          <Pressable
            onPress={handleSkip}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <Text
              style={{
                fontFamily: typography.fonts.bodySemi,
                fontSize: typography.sizes.md,
                color: colors.textSecondary,
              }}
            >
              Skip
            </Text>
          </Pressable>
        ) : (
          <View style={{ height: 20 }} />
        )}
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, i) => ({
          length: width,
          offset: width * i,
          index: i,
        })}
        style={styles.flex}
      />

      {/* Dots */}
      <View style={[styles.dots, { marginBottom: spacing.xl }]}>
        {SLIDES.map((s, i) => {
          const active = i === index;
          return (
            <MotiView
              key={s.id}
              animate={{
                width: active ? 26 : 8,
                backgroundColor: active ? colors.primary : colors.border,
              }}
              transition={{ type: "timing", duration: 260 }}
              style={styles.dot}
            />
          );
        })}
      </View>

      {/* Actions */}
      <View style={[styles.actions, { paddingHorizontal: spacing.xl }]}>
        <Button
          label={isLast ? "Get started" : "Next"}
          variant="gradient"
          size="lg"
          fullWidth
          onPress={handleNext}
        />
      </View>
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
  topBar: {
    height: 44,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  artWrap: {
    width: 280,
    height: 280,
    borderRadius: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  actions: {
    paddingBottom: 8,
  },
});
