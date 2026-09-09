import React, { useEffect } from 'react';
import { ActivityIndicator, StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useStyled } from 'hooks';

import { Text } from '../Text/Text';

import styles from './Toast.styles';

const ENTER_DURATION = 200;
const ENTER_OFFSET = -12;

interface ToastProps {
  visible: boolean;
  message: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  loading = false,
  style,
}) => {
  const { colors } = useStyled();
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
            backgroundColor: colors.surfaceContainer,
            borderColor: colors.border,
            shadowColor: colors.shadow,
          },
          animatedStyle,
        ]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
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
