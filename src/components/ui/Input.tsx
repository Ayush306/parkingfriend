import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardTypeOptions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/ThemeContext";

export interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  iconLeft?: React.ReactNode;
  secureTextEntry?: boolean;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  multiline?: boolean;
  right?: React.ReactNode;
  autoFocus?: boolean;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  iconLeft,
  secureTextEntry,
  error,
  keyboardType,
  maxLength,
  multiline,
  right,
  autoFocus,
}: InputProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);

  const borderColor = error
    ? colors.error
    : focused
    ? colors.primary
    : colors.border;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text
          style={{
            fontFamily: typography.fonts.bodyMedium,
            fontSize: typography.sizes.sm,
            color: colors.textSecondary,
            marginBottom: spacing.xs + 2,
          }}
        >
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.surface,
            borderColor,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            minHeight: multiline ? 96 : 52,
            alignItems: multiline ? "flex-start" : "center",
            borderWidth: focused ? 1.5 : 1,
          },
        ]}
      >
        {iconLeft ? (
          <View
            style={[
              styles.iconLeft,
              { marginTop: multiline ? spacing.md : 0 },
            ]}
          >
            {iconLeft}
          </View>
        ) : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label ?? placeholder}
          style={[
            styles.input,
            {
              color: colors.text,
              fontFamily: typography.fonts.body,
              fontSize: typography.sizes.md,
              paddingVertical: multiline ? spacing.md : 0,
              textAlignVertical: multiline ? "top" : "center",
            },
          ]}
        />

        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            style={styles.right}
          >
            <Ionicons
              name={hidden ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : right ? (
          <View style={styles.right}>{right}</View>
        ) : null}
      </View>

      {error ? (
        <Text
          style={{
            fontFamily: typography.fonts.body,
            fontSize: typography.sizes.xs,
            color: colors.error,
            marginTop: spacing.xs,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  field: {
    flexDirection: "row",
  },
  input: {
    flex: 1,
  },
  iconLeft: {
    marginRight: 10,
  },
  right: {
    marginLeft: 10,
    alignSelf: "center",
  },
});
