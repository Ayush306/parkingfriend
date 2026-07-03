import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  darkColors,
  gradients,
  lightColors,
  radius,
  shadows,
  spacing,
  typography,
  type Gradients,
  type Radius,
  type Shadows,
  type Spacing,
  type ThemeColors,
  type Typography,
} from "@/theme";

const THEME_STORAGE_KEY = "pm_theme";

export interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  toggle: () => void;
  setDark: (value: boolean) => void;
  spacing: Spacing;
  radius: Radius;
  typography: Typography;
  shadows: Shadows;
  gradients: Gradients;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(false);

  // Load the persisted preference once on mount. Fall back to the OS scheme
  // when the user has never made an explicit choice.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (!active) return;
        if (stored === "dark") {
          setIsDark(true);
        } else if (stored === "light") {
          setIsDark(false);
        } else if (systemScheme === "dark") {
          setIsDark(true);
        }
      } catch {
        // ignore read failures and keep the default light theme
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => {
      active = false;
    };
    // Only run on mount; systemScheme is only used as an initial fallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback(async (value: boolean) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, value ? "dark" : "light");
    } catch {
      // best-effort persistence; ignore write failures
    }
  }, []);

  const setDark = useCallback(
    (value: boolean) => {
      setIsDark(value);
      void persist(value);
    },
    [persist]
  );

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      void persist(next);
      return next;
    });
  }, [persist]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: isDark ? darkColors : lightColors,
      isDark,
      toggle,
      setDark,
      spacing,
      radius,
      typography,
      shadows,
      gradients,
    }),
    [isDark, toggle, setDark]
  );

  // hydrated is intentionally not gating render: the app shows the default
  // light theme instantly and swaps once the stored preference resolves,
  // avoiding a blank first frame. Referenced to satisfy the linter.
  void hydrated;

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
};

export default ThemeProvider;
