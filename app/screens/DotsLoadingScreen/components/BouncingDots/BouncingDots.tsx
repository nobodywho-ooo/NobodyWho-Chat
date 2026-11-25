import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useStyled } from 'hooks';
import { loaderDot as LoaderDot } from 'svg';

import styles, { AMPLITUDE, DOT_SIZE } from './BouncingDots.styles';

const STEP_MS = 360;
const PAUSE_MS = 600;

const KEYFRAMES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [0, 0.6, 1],
  [0.4, 1, 0],
  [1, 0.4, -0.3],
  [0, -0.3, 0],
  [-0.3, 0, 0],
  [0, 0, 0],
];

const STEP_COUNT = KEYFRAMES.length - 1;
const CYCLE_MS = STEP_COUNT * STEP_MS + PAUSE_MS;

const DOT_KEYFRAMES = [0, 1, 2].map(dot => KEYFRAMES.map(frame => frame[dot]));

interface DotProps {
  keyframes: number[];
  clock: SharedValue<number>;
  color: string;
}

const Dot: React.FC<DotProps> = ({ keyframes, clock, color }) => {
  const style = useAnimatedStyle(() => {
    const time = Math.min(clock.value / STEP_MS, STEP_COUNT);
    const step = Math.min(Math.floor(time), STEP_COUNT - 1);
    const local = time - step;
    const eased = local * local * (3 - 2 * local);
    const height =
      keyframes[step] + (keyframes[step + 1] - keyframes[step]) * eased;

    return { transform: [{ translateY: -height * AMPLITUDE }] };
  });

  return (
    <Animated.View style={style}>
      <LoaderDot width={DOT_SIZE} height={DOT_SIZE} color={color} />
    </Animated.View>
  );
};

export const BouncingDots: React.FC = () => {
  const { colors } = useStyled();
  const reducedMotion = useReducedMotion();
  const clock = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      clock.value = 0;
      return;
    }
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(CYCLE_MS, {
        duration: CYCLE_MS,
        easing: Easing.linear,
      }),
      -1,
    );
    return () => cancelAnimation(clock);
  }, [reducedMotion, clock]);

  const dotColors = [colors.primary, colors.secondary, colors.tertiary];

  return (
    <View
      testID="bouncing-dots"
      accessibilityRole="progressbar"
      style={styles.row}
    >
      {DOT_KEYFRAMES.map((keyframes, index) => (
        <Dot
          key={index}
          keyframes={keyframes}
          clock={clock}
          color={dotColors[index]}
        />
      ))}
    </View>
  );
};
