import React, { forwardRef, useCallback, useMemo } from "react";
import { StyleSheet, View, Text, ViewStyle } from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useTheme } from "@/theme/ThemeContext";

export type AppBottomSheetRef = BottomSheetModal;

export interface AppBottomSheetProps {
  children: React.ReactNode;
  snapPoints?: (string | number)[];
  title?: string;
  scroll?: boolean;
  onDismiss?: () => void;
  enablePanDownToClose?: boolean;
  contentStyle?: ViewStyle | ViewStyle[];
}

/**
 * Premium themed wrapper over @gorhom/bottom-sheet's BottomSheetModal.
 * Use with a ref: present() / dismiss().
 *
 *   const sheetRef = useRef<AppBottomSheetRef>(null);
 *   sheetRef.current?.present();
 *
 * Remember to wrap the app (or the nearest screen tree) in
 * <BottomSheetModalProvider> from @gorhom/bottom-sheet.
 */
export const AppBottomSheet = forwardRef<AppBottomSheetRef, AppBottomSheetProps>(
  (
    {
      children,
      snapPoints,
      title,
      scroll = false,
      onDismiss,
      enablePanDownToClose = true,
      contentStyle,
    },
    ref
  ) => {
    const { colors, spacing, typography, radius } = useTheme();

    const points = useMemo(
      () => snapPoints ?? ["50%"],
      [snapPoints]
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.45}
          pressBehavior="close"
        />
      ),
      []
    );

    const Header = title ? (
      <Text
        style={{
          color: colors.text,
          fontFamily: typography.fonts.heading,
          fontSize: typography.sizes.xl,
          marginBottom: spacing.md,
        }}
      >
        {title}
      </Text>
    ) : null;

    const innerPadding = {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
      paddingTop: spacing.sm,
    };

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={points}
        onDismiss={onDismiss}
        enablePanDownToClose={enablePanDownToClose}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{
          backgroundColor: colors.border,
          width: 44,
        }}
        backgroundStyle={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.xxl,
          borderTopRightRadius: radius.xxl,
        }}
      >
        {scroll ? (
          <BottomSheetScrollView
            contentContainerStyle={[innerPadding, contentStyle as ViewStyle]}
            showsVerticalScrollIndicator={false}
          >
            {Header}
            {children}
          </BottomSheetScrollView>
        ) : (
          <BottomSheetView style={[innerPadding, contentStyle as ViewStyle]}>
            {Header}
            <View>{children}</View>
          </BottomSheetView>
        )}
      </BottomSheetModal>
    );
  }
);

AppBottomSheet.displayName = "AppBottomSheet";

const styles = StyleSheet.create({});
