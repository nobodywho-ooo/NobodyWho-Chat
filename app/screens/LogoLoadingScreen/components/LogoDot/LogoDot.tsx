import React, { useEffect } from 'react';
import Animated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { haptics } from 'helpers';
import { logoDot as Dot } from 'svg';

import {
  cellOrigin,
  cellViewBox,
  type Cell,
} from '../../LogoLoadingScreen.constants';
import styles from './LogoDot.styles';

const SPRING = { mass: 0.6, damping: 11, stiffness: 260 };

interface LogoDotProps {
  cell: Cell;
  delay: number;
  width: number;
  height: number;
  color: string;
  haptic?: 'medium' | 'heavy';
  instant?: boolean;
}

export const LogoDot: React.FC<LogoDotProps> = ({
  cell,
  delay,
  width,
  height,
  color,
  haptic,
  instant = false,
}) => {
  const progress = useSharedValue(instant ? 1 : 0);

  useEffect(() => {
    if (instant) {
      progress.value = 1;
      return;
    }
    const timeout = setTimeout(() => {
      if (haptic) {
        haptics[haptic]();
      }
      progress.value = withSpring(1, SPRING);
    }, delay);
    return () => {
      clearTimeout(timeout);
      cancelAnimation(progress);
    };
  }, [instant, delay, haptic, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.3, 1]) }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.layer, { transformOrigin: cellOrigin(cell) }, style]}
    >
      <Dot
        width={width}
        height={height}
        viewBox={cellViewBox(cell)}
        preserveAspectRatio="none"
        color={color}
      />
    </Animated.View>
  );
};
