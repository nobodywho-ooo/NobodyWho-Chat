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

type FontWeight = '400' | '500' | '600' | '700' | '800';

interface ShimmerTextProps {
  text: string;
  width?: number; /** Available width to wrap within (px). Defaults to the text's own width, on one line. */
  fontSize?: number;
  fontWeight?: FontWeight;
  fontFamily?: string;
  baseColor?: string;
  highlightColor?: string;
  /**
   * The solid colour behind the text. The sweep is a gap in a veil of this
   * colour, so it has to match.
   */
  backgroundColor?: string;
  periodMs?: number;
  maxLines?: number;
  align?: 'left' | 'center';
}

const LINE_HEIGHT_RATIO = 1.3;
const MIN_BAND_WIDTH = 60;

const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 0 };

/**
 * How opaque a veil of `backdrop` has to be to turn `highlight` into `base`.
 * Least squares across the channels: exact for the palette's greys, the closest
 * match otherwise. Null when no veil can do it — a colour that can't be parsed,
 * or a highlight that is the backdrop colour.
 */
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

/**
 * Text with a highlight band sweeping across it. The text itself is drawn in
 * the highlight colour and covered by a veil of the background colour, opaque
 * enough to read as the base colour; the band is a soft gap in that veil, slid
 * along on the UI thread. Same trick as ThinkingBlock's fade: it only needs the
 * text to sit on a solid `backgroundColor`.
 */
export const ShimmerText: React.FC<ShimmerTextProps> = ({
  text,
  width,
  fontSize = 14,
  fontWeight = '600',
  fontFamily,
  baseColor,
  highlightColor,
  backgroundColor,
  periodMs = 1500,
  maxLines = 3,
  align = 'left',
}) => {
  const { colors } = useStyled();
  const base = baseColor ?? colors.onSurfaceVariant;
  const highlight = highlightColor ?? colors.onSurface;
  const backdrop = backgroundColor ?? colors.surface;
  const reducedMotion = useReducedMotion();

  // Without a `width` the box shrinks to the text, so how far the band has to
  // travel is only known once it has been laid out.
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const boxWidth = width ?? measuredWidth;

  const veil = useMemo(() => {
    const opacity = veilOpacity(highlight, base, backdrop);
    return opacity === null
      ? null
      : { color: withAlpha(backdrop, opacity), clear: withAlpha(backdrop, 0) };
  }, [highlight, base, backdrop]);

  // Until there is a box to sweep — or for good with reduced motion — the text
  // is simply drawn in the base colour, so it never flashes the highlight.
  const isSweeping = veil !== null && boxWidth > 0 && !reducedMotion;

  const band = Math.max(MIN_BAND_WIDTH, boxWidth * 0.5);
  const travel = boxWidth + band * 2;
  // The veil is one strip: solid, then the band (veil → gap → veil), then solid
  // again — each solid run long enough to cover the box wherever the band is.
  const solid = boxWidth + band;
  const stripWidth = solid * 2 + band;

  const progress = useSharedValue(0);

  useEffect(() => {
    if (!isSweeping) {
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: periodMs, easing: Easing.linear }),
      -1,
    );
    return () => cancelAnimation(progress);
  }, [isSweeping, periodMs, progress]);

  // At 0 the band sits just left of the text; at 1 it has crossed and cleared
  // it.
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 1) * travel }],
  }));

  const onLayout =
    width === undefined
      ? (event: LayoutChangeEvent) =>
          setMeasuredWidth(event.nativeEvent.layout.width)
      : undefined;

  return (
    <View
      style={[styles.container, width !== undefined && { width }]}
      onLayout={onLayout}
    >
      <Text
        numberOfLines={width === undefined ? 1 : maxLines}
        style={{
          color: isSweeping ? highlight : base,
          fontSize,
          fontWeight,
          fontFamily,
          lineHeight: Math.ceil(fontSize * LINE_HEIGHT_RATIO),
          textAlign: align,
        }}
      >
        {text}
      </Text>
      {isSweeping && veil !== null && (
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
