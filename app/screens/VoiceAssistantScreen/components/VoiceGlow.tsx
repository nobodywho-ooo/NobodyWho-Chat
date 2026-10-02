import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  type FrameInfo,
  type SharedValue,
} from 'react-native-reanimated';
import { withAlpha } from 'helpers';
import { useStyled } from 'hooks';
import { Spacings } from 'style';

import type { VoiceLevels } from '../hooks';

const HEIGHT_RATIO = 0.5;

// The drawer's corner radius (RootDrawerNavigator) since the drawer doesn't clip what's drawn in it
const CORNER_RADIUS = Spacings.xxxl;

// Same delta clamp as the level smoothing — a hitch advances the drift, not jumps it
const MAX_DT_MS = 100;

// Drift tempo, in phase units per second: lazy in silence, livelier while sound
// is flowing, and quicker still on a loud syllable.
const IDLE_TEMPO = 1;
const AWAKE_TEMPO = 0.6;
const LOUD_TEMPO = 1.4;

// Radial falloff (1 − t²)²: a soft shoulder rather than a cone, so overlapping
// blobs melt into each other without showing a rim.
const FALLOFF: ReadonlyArray<readonly [position: number, alpha: number]> = [
  [0, 1],
  [20, 0.92],
  [40, 0.71],
  [60, 0.41],
  [80, 0.13],
  [100, 0],
];

type Tone = 'body' | 'haze' | 'core';

/** x,y: centre, as fractions of the width and of the height above the bottom. */
/** rx,ry: radii, as fractions of the width and the height. */
/** rest,peak: opacity in silence, and with its band wide open. */
/** driftX,driftY: drift amplitude, as fractions of the width and the height. */
/** speed,offset: drift speed (radians per phase unit) and offset, so none move in step. */
/** lift: rise at full drive, as a fraction of the height. */
/** swell: vertical swell at full drive (it widens by 40% of that). */
interface Blob {
  tone: Tone;
  x: number;
  y: number;
  rx: number;
  ry: number;
  rest: number;
  peak: number;
  driftX: number;
  driftY: number;
  speed: number;
  offset: number;
  band: 'level' | 'low' | 'high';
  lift: number;
  swell: number;
}

const BLOBS: ReadonlyArray<Blob> = [
  {
    tone: 'body',
    x: 0.5,
    y: -0.12,
    rx: 0.95,
    ry: 0.62,
    rest: 0.9,
    peak: 1,
    driftX: 0.04,
    driftY: 0.03,
    speed: 0.55,
    offset: 0,
    band: 'low',
    lift: 0.08,
    swell: 0.25,
  },
  {
    tone: 'core',
    x: 0.12,
    y: -0.05,
    rx: 0.5,
    ry: 0.55,
    rest: 0.55,
    peak: 0.85,
    driftX: 0.08,
    driftY: 0.05,
    speed: 0.43,
    offset: 1.7,
    band: 'level',
    lift: 0.15,
    swell: 0.2,
  },
  {
    tone: 'haze',
    x: 0.86,
    y: -0.08,
    rx: 0.48,
    ry: 0.48,
    rest: 0.85,
    peak: 1,
    driftX: 0.06,
    driftY: 0.04,
    speed: 0.5,
    offset: 3.9,
    band: 'high',
    lift: 0.1,
    swell: 0.22,
  },
  {
    tone: 'core',
    x: 0.5,
    y: -0.1,
    rx: 0.42,
    ry: 0.5,
    rest: 0,
    peak: 0.8,
    driftX: 0.12,
    driftY: 0.03,
    speed: 0.37,
    offset: 5.1,
    band: 'level',
    lift: 0.22,
    swell: 0.35,
  },
  {
    tone: 'haze',
    x: 0.32,
    y: 0.02,
    rx: 0.35,
    ry: 0.32,
    rest: 0.35,
    peak: 0.6,
    driftX: 0.15,
    driftY: 0.04,
    speed: 0.31,
    offset: 2.6,
    band: 'high',
    lift: 0.12,
    swell: 0.15,
  },
];

const radialGradient = (color: string) =>
  `radial-gradient(closest-side, ${FALLOFF.map(
    ([position, alpha]) => `${withAlpha(color, alpha)} ${position}%`,
  ).join(', ')})`;

interface GlowBlobProps {
  blob: Blob;
  gradient: string;
  width: number;
  height: number;
  phase: SharedValue<number>;
  levels: VoiceLevels;
  motion: number; /** 1 normally, 0 with reduced motion: the blob then only brightens. */
}

const GlowBlob: React.FC<GlowBlobProps> = ({
  blob,
  gradient,
  width,
  height,
  phase,
  levels,
  motion,
}) => {
  const { level, low, high, active } = levels;

  const animatedStyle = useAnimatedStyle(() => {
    const drive =
      blob.band === 'low'
        ? low.value
        : blob.band === 'high'
          ? high.value
          : level.value;
    const t = phase.value * blob.speed + blob.offset;

    const driftX = blob.driftX * width * Math.sin(t);
    const driftY = blob.driftY * height * Math.sin(t * 1.37 + 1.1);
    const breathe = 0.04 * Math.sin(t * 0.71 + 2.3);
    const swell = blob.swell * drive;

    return {
      opacity:
        blob.rest +
        (blob.peak - blob.rest) * Math.max(drive, 0.5 * active.value),
      transform: [
        { translateX: motion * driftX },
        { translateY: motion * (driftY - blob.lift * height * drive) },
        { scaleX: 1 + motion * (breathe + 0.4 * swell) },
        { scaleY: 1 + motion * (breathe + swell) },
      ],
    };
  });

  const blobWidth = blob.rx * 2 * width;
  const blobHeight = blob.ry * 2 * height;

  return (
    <Animated.View
      style={[
        styles.blobContainer,
        {
          left: blob.x * width - blobWidth / 2,
          bottom: blob.y * height - blobHeight / 2,
          width: blobWidth,
          height: blobHeight,
        },
        animatedStyle,
      ]}
    >
      <View
        style={[
          styles.fillContainer,
          { experimental_backgroundImage: gradient },
        ]}
      />
    </Animated.View>
  );
};

interface VoiceGlowProps {
  levels: VoiceLevels;
  paused?: boolean;
}

export const VoiceGlow: React.FC<VoiceGlowProps> = ({
  levels,
  paused = false,
}) => {
  const { colors } = useStyled();
  const windowSize = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  const height = Math.round(windowSize.height * HEIGHT_RATIO);
  const [width, setWidth] = useState(windowSize.width);

  const gradients = useMemo<Record<Tone, string>>(
    () => ({
      body: radialGradient(colors.voiceGlowBody),
      haze: radialGradient(colors.voiceGlowHaze),
      core: radialGradient(colors.voiceGlowCore),
    }),
    [colors.voiceGlowBody, colors.voiceGlowHaze, colors.voiceGlowCore],
  );

  const { level, active } = levels;
  const phase = useSharedValue(0);

  const onFrame = useCallback(
    (info: FrameInfo) => {
      'worklet';
      let dt = info.timeSincePreviousFrame ?? 0;
      if (dt > MAX_DT_MS) dt = MAX_DT_MS;
      const tempo =
        IDLE_TEMPO + AWAKE_TEMPO * active.value + LOUD_TEMPO * level.value;
      phase.value += (dt / 1000) * tempo;
    },
    [phase, active, level],
  );

  const frame = useFrameCallback(onFrame, false);

  useEffect(() => {
    frame.setActive(!paused && !reducedMotion);
    return () => frame.setActive(false);
  }, [frame, paused, reducedMotion]);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width),
    [],
  );

  return (
    <View pointerEvents="none" style={[styles.glowContainer, { height }]}>
      <View style={styles.fieldContainer} onLayout={onLayout}>
        {BLOBS.map((blob, index) => (
          <GlowBlob
            key={index}
            blob={blob}
            gradient={gradients[blob.tone]}
            width={width}
            height={height}
            phase={phase}
            levels={levels}
            motion={reducedMotion ? 0 : 1}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  glowContainer: {
    position: 'absolute',
    left: 0,
    right: -CORNER_RADIUS,
    bottom: 0,
    borderRadius: CORNER_RADIUS,
    overflow: 'hidden',
  },
  fieldContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: CORNER_RADIUS,
  },
  blobContainer: {
    position: 'absolute',
  },
  fillContainer: {
    flex: 1,
  },
});
