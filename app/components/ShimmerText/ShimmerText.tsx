import React, { useEffect, useMemo, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { parseColor, withAlpha } from 'helpers';
import { useStyled } from 'hooks';

import styles from './ShimmerText.styles';

interface ShimmerTextProps {
  text: string;
  fontSize?: number;
}

const LINE_HEIGHT_RATIO = 1.3;
const MIN_BAND_WIDTH = 60;
const PERIOD_MS = 1500;

const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 0 };

// How opaque a veil of `backdrop` has to be to turn `highlight` into `base`
const veilOpacity = (
  highlight: string,
  base: string,
  backdrop: string,
): number | null => {
  const h = parseColor(highlight);
  const b = parseColor(base);
  const d = parseColor(backdrop);

  if (!h || !b || !d) {
    return null;
  }

  let numerator = 0;
  let denominator = 0;

  for (const channel of ['r', 'g', 'b'] as const) {
    const towardsBackdrop = d[channel] - h[channel];
    numerator += (b[channel] - h[channel]) * towardsBackdrop;
    denominator += towardsBackdrop * towardsBackdrop;
  }

  if (denominator === 0) {
    return null;
  }

  return Math.min(1, Math.max(0, numerator / denominator));
};

export const ShimmerText: React.FC<ShimmerTextProps> = ({
  text,
  fontSize = 14,
}) => {
  const { colors } = useStyled();
  const base = colors.onSurfaceVariant;
  const highlight = colors.onSurface;
  const backdrop = colors.surface;
  const reducedMotion = useReducedMotion();

  // The box shrinks to the text, so how far the band has to travel is only known once it has been laid out.
  const [width, setWidth] = useState(0);

  const veil = useMemo(() => {
    const opacity = veilOpacity(highlight, base, backdrop);
    return opacity === null
      ? null
      : { color: withAlpha(backdrop, opacity), clear: withAlpha(backdrop, 0) };
  }, [highlight, base, backdrop]);

  // Until there is a box to sweep — or for good with reduced motion — the text
  // is simply drawn in the base colour, so it never flashes the highlight.
  const isSweeping = veil !== null && width > 0 && !reducedMotion;

  const band = Math.max(MIN_BAND_WIDTH, width * 0.5);
  const travel = width + band * 2;

  const solid = width + band;
  const stripWidth = solid * 2 + band;

  const progress = useSharedValue(0);

  useEffect(() => {
    if (!isSweeping) {
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: PERIOD_MS, easing: Easing.linear }),
      -1,
    );
    return () => cancelAnimation(progress);
  }, [isSweeping, progress]);

  // At 0 the band sits just left of the text; at 1 it has crossed and cleared it.
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 1) * travel }],
  }));

  const onLayout = (event: LayoutChangeEvent) =>
    setWidth(event.nativeEvent.layout.width);

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Text
        numberOfLines={1}
        style={[
          styles.text,
          {
            color: isSweeping ? highlight : base,
            fontSize,
            lineHeight: Math.ceil(fontSize * LINE_HEIGHT_RATIO),
          },
        ]}
      >
        {text}
      </Text>
      {isSweeping && (
        <View pointerEvents="none" style={styles.veilContainer}>
          <Animated.View
            style={[styles.stripContainer, { width: stripWidth }, sweepStyle]}
          >
            <LinearGradient
              style={styles.gradientContainer}
              start={GRADIENT_START}
              end={GRADIENT_END}
              colors={[
                veil.color,
                veil.color,
                veil.clear,
                veil.color,
                veil.color,
              ]}
              locations={[
                0,
                solid / stripWidth,
                (solid + band / 2) / stripWidth,
                (solid + band) / stripWidth,
                1,
              ]}
            />
          </Animated.View>
        </View>
      )}
    </View>
  );
};
