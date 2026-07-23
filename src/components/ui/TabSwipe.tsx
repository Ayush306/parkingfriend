import React from "react";
import { View, StyleProp, ViewStyle } from "react-native";
import {
  Directions,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";

interface TabSwipeProps {
  /** Finger flings LEFT → move to the NEXT tab (standard messenger feel). */
  onNext: () => void;
  /** Finger flings RIGHT → move to the PREVIOUS tab. */
  onPrev: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Left/right finger-swipe to switch between tabs, the way WhatsApp and
 * Instagram do it. Fling-based (not pan), so it never fights the vertical
 * scroll of the list it wraps — a quick horizontal flick is all it takes.
 *
 * No haptic here: the screens clamp at the first/last tab, and a buzz with
 * zero visual change reads as broken. Each screen's shiftTab fires the
 * haptic only when the tab really moves.
 */
export function TabSwipe({ onNext, onPrev, style, children }: TabSwipeProps) {
  // Recreated each render so the callbacks always see the CURRENT tab.
  const flingLeft = Gesture.Fling()
    .direction(Directions.LEFT)
    .runOnJS(true)
    .onEnd((_e, success) => {
      if (success) onNext();
    });
  const flingRight = Gesture.Fling()
    .direction(Directions.RIGHT)
    .runOnJS(true)
    .onEnd((_e, success) => {
      if (success) onPrev();
    });

  return (
    <GestureDetector gesture={Gesture.Race(flingLeft, flingRight)}>
      {/* collapsable=false: the detector needs a real native view to attach to. */}
      <View style={style} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  );
}
