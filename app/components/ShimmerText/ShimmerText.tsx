import React, { useEffect, useMemo, useState } from 'react';
import {
  Text,
  View,
  type LayoutChangeEvent,
  type ViewProps,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import MaskedViewNative from '@react-native-masked-view/masked-view';
import LinearGradient from 'react-native-linear-gradient';
import { withAlpha } from 'helpers';
import { useStyled } from 'hooks';

import styles from './ShimmerText.styles';

const MaskedView = MaskedViewNative as unknown as React.ComponentType<
  ViewProps & { maskElement: React.ReactElement }
>;

interface ShimmerTextProps {
  text: string;
  fontSize?: number;
}

const LINE_HEIGHT_RATIO = 1.3;
const MIN_BAND_WIDTH = 60;
const PERIOD_MS = 1500;

const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 0 };
const BAND_LOCATIONS = [0, 0.5, 1];

export const ShimmerText: React.FC<ShimmerTextProps> = ({
  text,
  fontSize = 14,
}) => {
  const { colors } = useStyled();
  const base = colors.onSurfaceVariant;
  const highlight = colors.onSurface;
  const reducedMotion = useReducedMotion();

  // The box shrinks to the text, so how far the band has to travel is only known once it has been laid out.
  const [width, setWidth] = useState(0);

  // Until there is a box to sweep — or for good with reduced motion — the text
  // is simply drawn in the base colour.
  const isSweeping = width > 0 && !reducedMotion;

  const band = Math.max(MIN_BAND_WIDTH, width * 0.5);
  const travel = width + band;

  const bandColors = useMemo(
    () => [withAlpha(highlight, 0), highlight, withAlpha(highlight, 0)],
    [highlight],
  );

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
    transform: [{ translateX: progress.value * travel - band }],
  }));

  const onLayout = (event: LayoutChangeEvent) =>
    setWidth(event.nativeEvent.layout.width);

  const textStyle = [
    styles.text,
    { fontSize, lineHeight: Math.ceil(fontSize * LINE_HEIGHT_RATIO) },
  ];

  const label = (
    <Text numberOfLines={1} style={[textStyle, { color: base }]}>
      {text}
    </Text>
  );

  if (!isSweeping) {
    return (
      <View style={styles.container} onLayout={onLayout}>
        {label}
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      onLayout={onLayout}
      accessible
      accessibilityRole="text"
      accessibilityLabel={text}
    >
      <MaskedView style={styles.maskContainer} maskElement={label}>
        <Text
          numberOfLines={1}
          style={[textStyle, styles.sizerText]}
          importantForAccessibility="no"
        >
          {text}
        </Text>
        <View style={[styles.fillContainer, { backgroundColor: base }]} />
        <Animated.View
          style={[styles.bandContainer, { width: band }, sweepStyle]}
        >
          <LinearGradient
            style={styles.fillContainer}
            start={GRADIENT_START}
            end={GRADIENT_END}
            colors={bandColors}
            locations={BAND_LOCATIONS}
          />
        </Animated.View>
      </MaskedView>
    </View>
  );
};
