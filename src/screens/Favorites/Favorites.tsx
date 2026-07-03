import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import { MotiView } from "moti";

import { useTheme } from "@/theme/ThemeContext";
import { useAsync } from "@/hooks/useAsync";
import { useFavorites } from "@/hooks/useFavorites";
import { useToast } from "@/components/ui/Toast";
import { spotService } from "@/services/spotService";
import type { ParkingSpot } from "@/models/types";

import { Header } from "@/components/ui/Header";
import { SpotCard } from "@/components/ui/SpotCard";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

export default function Favorites() {
  const navigation = useNavigation<any>();
  const { colors, spacing, typography } = useTheme();
  const { toggle } = useFavorites();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const favAsync = useAsync<ParkingSpot[]>(() => spotService.getFavorites(), []);

  // Refresh when returning to this screen (e.g. after favoriting elsewhere).
  useFocusEffect(
    useCallback(() => {
      favAsync.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    favAsync.refetch();
    setTimeout(() => setRefreshing(false), 800);
  }, [favAsync]);

  const spots = favAsync.data ?? [];

  const remove = useCallback(
    async (spot: ParkingSpot) => {
      await toggle(spot.id);
      // Optimistically drop it from the visible list.
      favAsync.setData((prev) => (prev ?? []).filter((s) => s.id !== spot.id));
      toast.show("Removed from favorites", "info");
    },
    [toggle, favAsync, toast]
  );

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
        title="Favorites"
        subtitle={
          favAsync.loading
            ? "Loading…"
            : `${spots.length} saved ${spots.length === 1 ? "spot" : "spots"}`
        }
        showBack
        onBack={() => navigation.goBack()}
      />

      {favAsync.loading ? (
        <View style={{ paddingHorizontal: spacing.xl }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ marginBottom: spacing.md }}>
              <SkeletonCard />
            </View>
          ))}
        </View>
      ) : favAsync.error ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ErrorState
            subtitle="We couldn't load your saved spots."
            onRetry={favAsync.refetch}
          />
        </View>
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.huge,
            flexGrow: 1,
          }}
          ListHeaderComponent={
            spots.length > 0 ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.body,
                  fontSize: typography.sizes.sm,
                  marginBottom: spacing.md,
                }}
              >
                Your handpicked parking spots, ready to book.
              </Text>
            ) : null
          }
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
                favorite
                onToggleFavorite={() => remove(item)}
                onPress={() => openSpot(item.id)}
              />
            </MotiView>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No favorites yet"
              subtitle="Tap the heart on any parking spot to save it here for quick booking."
              actionLabel="Explore spots"
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
  empty: {
    marginTop: 48,
  },
});
