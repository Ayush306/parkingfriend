import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { MotiView } from "moti";

import { useTheme } from "@/theme/ThemeContext";
import { useAsync } from "@/hooks/useAsync";
import { useFavorites } from "@/hooks/useFavorites";
import { spotService, type SpotFilters } from "@/services/spotService";
import type { ParkingSpot } from "@/models/types";

import { Header } from "@/components/ui/Header";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SpotCard } from "@/components/ui/SpotCard";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SearchEmpty } from "@/components/illustrations";

const SORT_OPTIONS = ["Distance", "Price", "Rating"] as const;
type SortLabel = (typeof SORT_OPTIONS)[number];

const SORT_MAP: Record<SortLabel, SpotFilters["sort"]> = {
  Distance: "distance",
  Price: "priceLow",
  Rating: "rating",
};

export default function SearchResults() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, spacing, typography } = useTheme();
  const { isFavorite, toggle } = useFavorites();

  const query: string = (route.params as any)?.query ?? "";
  const passedFilters: SpotFilters = (route.params as any)?.filters ?? {};

  const [sort, setSort] = useState<SortLabel>("Distance");

  const serviceFilters = useMemo<SpotFilters>(
    () => ({ ...passedFilters, sort: SORT_MAP[sort] }),
    [passedFilters, sort]
  );

  const results = useAsync<ParkingSpot[]>(
    () => spotService.search(query, serviceFilters),
    [query, sort]
  );

  const spots = results.data ?? [];

  const openSpot = useCallback(
    (id: string) => navigation.navigate("SpotDetail", { id }),
    [navigation]
  );

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.flex, { backgroundColor: colors.bg }]}
    >
      <Header
        title={query ? `“${query}”` : "Search results"}
        subtitle={
          results.loading
            ? "Searching…"
            : `${spots.length} ${spots.length === 1 ? "spot" : "spots"} found`
        }
        showBack
        onBack={() => navigation.goBack()}
      />

      {/* Sort control */}
      <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.md }}>
        <View style={styles.sortRow}>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.bodyMedium,
              fontSize: typography.sizes.sm,
              marginRight: spacing.md,
            }}
          >
            Sort by
          </Text>
          <View style={styles.flex}>
            <SegmentedControl
              options={SORT_OPTIONS as unknown as string[]}
              value={sort}
              onChange={(v) => setSort(v as SortLabel)}
            />
          </View>
        </View>
      </View>

      {results.loading ? (
        <View style={{ paddingHorizontal: spacing.xl }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ marginBottom: spacing.md }}>
              <SkeletonCard />
            </View>
          ))}
        </View>
      ) : results.error ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ErrorState
            subtitle="We couldn't run your search. Please try again."
            onRetry={results.refetch}
          />
        </View>
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.huge,
            flexGrow: 1,
          }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item, index }) => (
            <MotiView
              from={{ opacity: 0, translateY: 14 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 320, delay: Math.min(index, 6) * 50 }}
            >
              <SpotCard
                spot={item}
                variant="list"
                favorite={isFavorite(item.id)}
                onToggleFavorite={() => toggle(item.id)}
                onPress={() => openSpot(item.id)}
              />
            </MotiView>
          )}
          ListEmptyComponent={
            <EmptyState
              illustration={SearchEmpty}
              title="No matching spots"
              subtitle={
                query
                  ? `We couldn't find parking for “${query}”. Try another station.`
                  : "Try searching for a station or area."
              }
              actionLabel="New search"
              onAction={() => navigation.navigate("Explore")}
              style={styles.empty}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  empty: {
    marginTop: 40,
  },
});
