import React, { RefObject, useEffect } from 'react';
import { ActivityIndicator, StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
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
  blurTarget?: RefObject<View | null>;
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

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: ENTER_OFFSET * (1 - progress.value) }],
  }));

  if (!visible) {
    return null;
  }

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <Animated.View
        style={[
          styles.toast,
          {
            borderColor: colors.borderSecondary,
            // shadowColor: colors.shadow,
          },
          animatedStyle,
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
        {loading && <ActivityIndicator size="small" color={colors.primary} />}
        <Text
          variant="body2"
          numberOfLines={2}
          style={[styles.message, { color: colors.onSurface }]}
        >
          {message}
        </Text>
      </Animated.View>
    </View>
  );
};
