/**
 * ParkingFriend design tokens.
 * All values are fixed per the build contract. Components/screens must read
 * colors, spacing, radius, typography, shadows and gradients via useTheme()
 * and never hardcode raw values.
 */

export const lightColors = {
  primary: "#0FB57E",
  primaryDark: "#0A9268",
  primaryLight: "#E6F7F0",
  secondary: "#6C5CE7",
  accent: "#FFB020",
  bg: "#F6F8FA",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F5F9",
  text: "#0B1B2B",
  textSecondary: "#54677A",
  textMuted: "#94A3B8",
  border: "#E6EBF0",
  success: "#16A34A",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
  star: "#FFB020",
  white: "#FFFFFF",
  overlay: "rgba(11,27,43,0.45)",
} as const;

export const darkColors = {
  primary: "#12C98B",
  primaryDark: "#0FB57E",
  primaryLight: "#0E2A22",
  secondary: "#8B7CF0",
  accent: "#FFC24D",
  bg: "#0B1220",
  surface: "#131C2B",
  surfaceAlt: "#1B2637",
  text: "#F1F5F9",
  textSecondary: "#A7B4C4",
  textMuted: "#6B7A8D",
  border: "#243247",
  success: "#22C55E",
  warning: "#FBBF24",
  error: "#F87171",
  info: "#60A5FA",
  star: "#FFC24D",
  white: "#FFFFFF",
  overlay: "rgba(0,0,0,0.55)",
} as const;

export type ThemeColors = { [K in keyof typeof lightColors]: string };

export const gradients = {
  primary: ["#12C98B", "#0A9268"],
  violet: ["#7F7FD5", "#6C5CE7"],
  sunset: ["#FF9A6B", "#FF5E62"],
  gold: ["#FFD16B", "#FFB020"],
  dark: ["#131C2B", "#0B1220"],
} as const;

export type Gradients = typeof gradients;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export type Spacing = typeof spacing;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

export type Radius = typeof radius;

export const typography = {
  fonts: {
    heading: "Poppins_600SemiBold",
    headingBold: "Poppins_700Bold",
    body: "Inter_400Regular",
    bodyMedium: "Inter_500Medium",
    bodySemi: "Inter_600SemiBold",
  },
  sizes: {
    xs: 12,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 30,
    display: 36,
  },
} as const;

export type Typography = typeof typography;

/**
 * Soft, subtle elevation. shadowColor is fixed to the brand ink color so
 * shadows read as warm depth rather than harsh grey on both platforms.
 */
export const shadows = {
  sm: {
    shadowColor: "#0B1B2B",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: "#0B1B2B",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  lg: {
    shadowColor: "#0B1B2B",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  xl: {
    shadowColor: "#0B1B2B",
    shadowOpacity: 0.14,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16,
  },
} as const;

export type Shadows = typeof shadows;

export const theme = {
  lightColors,
  darkColors,
  gradients,
  spacing,
  radius,
  typography,
  shadows,
};

export default theme;
