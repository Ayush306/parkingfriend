import React, { useRef, useEffect } from "react";
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from "react-native";
import { useTheme } from "@/theme/ThemeContext";

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
}: OtpInputProps) {
  const { colors, radius, typography, spacing } = useTheme();
  const inputRef = useRef<TextInput>(null);

  const digits = React.useMemo(() => {
    const arr = value.split("").slice(0, length);
    while (arr.length < length) arr.push("");
    return arr;
  }, [value, length]);

  const activeIndex = Math.min(value.length, length - 1);

  useEffect(() => {
    if (value.length === length) {
      onComplete?.(value);
    }
  }, [value, length, onComplete]);

  const handleChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, "").slice(0, length);
    onChange(clean);
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>
  ) => {
    if (e.nativeEvent.key === "Backspace" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <Pressable
      style={styles.wrap}
      onPress={() => inputRef.current?.focus()}
      accessibilityLabel="OTP input"
    >
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onKeyPress={handleKeyPress}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus
        caretHidden
        style={styles.hiddenInput}
        textContentType="oneTimeCode"
      />
      <View style={[styles.boxes, { gap: spacing.sm }]}>
        {digits.map((digit, i) => {
          const isActive = i === value.length || (i === activeIndex && value.length === length);
          const filled = digit !== "";
          return (
            <View
              key={i}
              style={[
                styles.box,
                {
                  borderRadius: radius.md,
                  backgroundColor: colors.surface,
                  borderColor: isActive
                    ? colors.primary
                    : filled
                    ? colors.primary
                    : colors.border,
                  borderWidth: isActive ? 2 : 1.5,
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: typography.fonts.headingBold,
                  fontSize: typography.sizes.xxl,
                  color: colors.text,
                }}
              >
                {digit}
              </Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
  boxes: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  box: {
    flex: 1,
    aspectRatio: 0.86,
    maxWidth: 56,
    alignItems: "center",
    justifyContent: "center",
  },
});
