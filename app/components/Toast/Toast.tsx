import React, { ComponentRef, RefObject, useEffect, useState } from 'react';
import { ActivityIndicator, StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import { useTheme } from 'context';
import { useStyled } from 'hooks';

import { Text } from '../Text/Text';

import styles from './Toast.styles';

const ENTER_DURATION = 200;
const ENTER_OFFSET = -12;
const BLUR_INTENSITY = 12;
const BLUR_REDUCTION_FACTOR = 4;

interface ToastProps {
  visible: boolean;
  message: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  blurTarget?: RefObject<ComponentRef<typeof View> | null>;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  loading = false,
  style,
  blurTarget,
}) => {
  const { colors } = useStyled();
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      progress.value = 0;
      return;
    }
    progress.value = withTiming(1, { duration: ENTER_DURATION });
  }, [visible, progress]);

  // UIKit glass renders nothing under an ancestor with opacity < 1, so on
  // the glass path only the slide is animated on the wrapper; the glass
  // materializes natively (effect 'none' -> 'regular') and the content fades
  // inside it.
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ENTER_OFFSET * (1 - progress.value) }],
  }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const [glassEffect, setGlassEffect] = useState<'none' | 'regular'>('none');

  useEffect(() => {
    if (!isLiquidGlassSupported) {
      return;
    }

    if (!visible) {
      setGlassEffect('none');
      return;
    }

    const frame = requestAnimationFrame(() => setGlassEffect('regular'));

    return () => cancelAnimationFrame(frame);
  }, [visible]);

  if (!visible) {
    return null;
  }

  const content = (
    <>
      {loading && <ActivityIndicator size="small" color={colors.primary} />}
      <Text
        variant="body2"
        numberOfLines={2}
        style={[styles.message, { color: colors.onSurface }]}
      >
        {message}
      </Text>
    </>
  );

  if (isLiquidGlassSupported) {
    return (
      <View style={[styles.container, style]} pointerEvents="none">
        <Animated.View
          style={[styles.glassWrapper, slideStyle]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <LiquidGlassView
            effect={glassEffect}
            colorScheme={theme}
            style={styles.glassToast}
          >
            <Animated.View style={[styles.row, fadeStyle]}>
              {content}
            </Animated.View>
          </LiquidGlassView>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <Animated.View
        style={[
          styles.toast,
          { borderColor: colors.borderSecondary },
          fadeStyle,
          slideStyle,
        ]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <BlurView
          style={styles.blurFill}
          intensity={BLUR_INTENSITY}
          tint={theme}
          blurMethod="dimezisBlurViewSdk31Plus"
          blurReductionFactor={BLUR_REDUCTION_FACTOR}
          blurTarget={blurTarget}
        />
        <View
          style={[styles.tint, { backgroundColor: colors.surfaceContainer }]}
        />
        {content}
      </Animated.View>
    </View>
  );
};
