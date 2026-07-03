import { useCallback, useEffect, useRef, useState } from "react";
import { spotService } from "@/services/spotService";

export interface UseFavoritesResult {
  /** Set of favorited spot ids. */
  favorites: string[];
  /** Whether the given spot id is currently favorited. */
  isFavorite: (id: string) => boolean;
  /** Toggles favorite state for a spot (optimistic, then persisted). */
  toggle: (id: string) => Promise<void>;
  /** True while the initial favorites list is loading. */
  loading: boolean;
  /** Reloads favorites from storage. */
  refresh: () => Promise<void>;
}

/**
 * Provides the set of favorited spot ids with optimistic toggling backed by
 * spotService (persisted to AsyncStorage under "pm_favorites").
 */
export function useFavorites(): UseFavoritesResult {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const ids = await spotService.getFavoriteIds();
      if (mountedRef.current) setFavorites(ids);
    } catch {
      if (mountedRef.current) setFavorites([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const isFavorite = useCallback(
    (id: string) => favorites.includes(id),
    [favorites]
  );

  const toggle = useCallback(async (id: string) => {
    // Optimistic update.
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    try {
      await spotService.toggleFavorite(id);
    } catch {
      // Revert on failure.
      setFavorites((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }
  }, []);

  return { favorites, isFavorite, toggle, loading, refresh: load };
}
