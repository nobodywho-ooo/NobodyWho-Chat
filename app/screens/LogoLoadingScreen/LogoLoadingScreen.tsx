import React, { useEffect, useRef } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useStyled } from 'hooks';
import { Spacings } from 'style';
import { logo as Logo } from 'svg';

import { LogoDot } from './components';
import {
  CENTER_CELL,
  CENTER_DELAY,
  CORNER_CELLS,
  CORNER_INTERVAL,
  FIRST_CORNER_DELAY,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  LOGO_HOLD,
  LOGO_WIDTH,
  REVEAL_DELAY,
  REVEAL_DURATION,
} from './LogoLoadingScreen.constants';
import styles from './LogoLoadingScreen.styles';

const GUTTER = Spacings.xxl;

interface LogoLoadingScreenProps {
  onAnimationEnd?: () => void;
}

export const LogoLoadingScreen: React.FC<LogoLoadingScreenProps> = ({
  onAnimationEnd,
}) => {
  const { colors } = useStyled();
  const reducedMotion = useReducedMotion();
  const window = useWindowDimensions();

  const width = Math.min(
    LOGO_WIDTH,
    window.width - GUTTER * 2,
    ((window.height - GUTTER * 2) * FRAME_WIDTH) / FRAME_HEIGHT,
  );
  const height = (width * FRAME_HEIGHT) / FRAME_WIDTH;

  const logoOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const dotsOpacity = useSharedValue(reducedMotion ? 0 : 1);

  const onAnimationEndRef = useRef(onAnimationEnd);
  onAnimationEndRef.current = onAnimationEnd;

  useEffect(() => {
    const endTimeout = setTimeout(
      () => onAnimationEndRef.current?.(),
      (reducedMotion ? 0 : REVEAL_DELAY + REVEAL_DURATION) + LOGO_HOLD,
    );
    if (reducedMotion) {
      logoOpacity.value = 1;
      dotsOpacity.value = 0;
      return () => clearTimeout(endTimeout);
    }
    const revealTimeout = setTimeout(() => {
      logoOpacity.value = withTiming(
        1,
        { duration: REVEAL_DURATION, easing: Easing.out(Easing.cubic) },
        finished => {
          if (finished) {
            dotsOpacity.value = 0;
          }
        },
      );
    }, REVEAL_DELAY);
    return () => {
      clearTimeout(endTimeout);
      clearTimeout(revealTimeout);
      cancelAnimation(logoOpacity);
    };
  }, [reducedMotion, logoOpacity, dotsOpacity]);

  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value }));
  const dotsStyle = useAnimatedStyle(() => ({ opacity: dotsOpacity.value }));

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View
        testID="logo-loading"
        accessibilityRole="progressbar"
        style={{ width, height }}
      >
        <Animated.View pointerEvents="none" style={[styles.layer, logoStyle]}>
          <Logo
            width={width}
            height={height}
            preserveAspectRatio="none"
            color={colors.onSurface}
          />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.layer, dotsStyle]}>
          <LogoDot
            cell={CENTER_CELL}
            delay={CENTER_DELAY}
            width={width}
            height={height}
            color={colors.onSurface}
            instant={reducedMotion}
          />
          {CORNER_CELLS.map((cell, index) => (
            <LogoDot
              key={`${cell.column}-${cell.row}`}
              cell={cell}
              delay={FIRST_CORNER_DELAY + index * CORNER_INTERVAL}
              width={width}
              height={height}
              color={colors.onSurface}
              haptic={index === CORNER_CELLS.length - 1 ? 'heavy' : 'medium'}
              instant={reducedMotion}
            />
          ))}
        </Animated.View>
      </View>
    </View>
  );
};
