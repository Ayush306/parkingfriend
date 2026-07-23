import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleProp,
  ViewStyle,
} from "react-native";

export interface KeyboardAvoiderProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Extra offset above the keyboard (e.g. a header height on iOS). */
  offset?: number;
}

/**
 * The one place the app avoids the on-screen keyboard.
 *
 * WHY it exists: Expo SDK 54+ / RN 0.76+ turns on Android **edge-to-edge** by
 * default, and under edge-to-edge Android STOPS resizing the window when the
 * keyboard opens (the old `adjustResize` is ignored). The long-standing
 * `behavior={Platform.OS === "ios" ? "padding" : undefined}` therefore did
 * nothing on Android — a text box near the bottom of the screen was left
 * hidden behind the keyboard.
 *
 * `KeyboardAvoidingView` itself is JS-driven: it listens to the OS keyboard
 * events and applies the inset in JavaScript, so it does NOT depend on the
 * native window resize. Setting `behavior="padding"` on BOTH platforms makes
 * it push whatever it wraps (a pinned composer, a footer button, a bottom
 * sheet, or a scroll form) up above the keyboard on Android too.
 *
 * Use it as the flex parent of a screen's scrollable/pinned content.
 */
export function KeyboardAvoider({ children, style, offset = 0 }: KeyboardAvoiderProps) {
  return (
    <KeyboardAvoidingView
      style={style}
      behavior="padding"
      keyboardVerticalOffset={offset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

/** Handy for callers that still branch on platform for their own offsets. */
export const isIOS = Platform.OS === "ios";
