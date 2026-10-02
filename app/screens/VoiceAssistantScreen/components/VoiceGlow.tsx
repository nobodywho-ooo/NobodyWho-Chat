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

// A mesh gradient by superposition: a handful of soft radial blobs piled along
// the bottom edge, each drifting on its own slow path and pushed up and out by
// the voice. A blob's gradient is static, built once per theme; per frame only
// its wrapper's transform and opacity change, on the UI thread. The wrapper is
// there for opacity: on iOS an opacity change rebuilds the view's own
// background-image layers, and the wrapper has none to rebuild.

/** The glow's canvas, as a fraction of the window's height. It rests in the
 * lower half; the rest is headroom for the voice to push into. */
const HEIGHT_RATIO = 0.5;

/** The drawer's corner radius (RootDrawerNavigator) — the drawer doesn't clip
 * what's drawn in it, so the glow clips itself to the same curve. */
const CORNER_RADIUS = Spacings.xxxl;

// Same delta clamp as the level smoothing — a hitch advances the drift, not
// jumps it.
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

interface Blob {
  tone: Tone;
  /** Centre, as fractions of the width and of the height above the bottom. */
  x: number;
  y: number;
  /** Radii, as fractions of the width and the height. */
  rx: number;
  ry: number;
  /** Opacity in silence, and with its band wide open. */
  rest: number;
  peak: number;
  /** Drift amplitude, as fractions of the width and the height. */
  driftX: number;
  driftY: number;
  /** Drift speed (radians per phase unit) and offset, so none move in step. */
  speed: number;
  offset: number;
  /** The band that drives it: vowels (low), sibilance (high), or both. */
  band: 'level' | 'low' | 'high';
  /** Rise at full drive, as a fraction of the height. */
  lift: number;
  /** Vertical swell at full drive (it widens by 40% of that). */
  swell: number;
}

// Back to front. The body is the wash along the edge, swelling on vowels; the
// two lobes give it an uneven silhouette, deeper on the left and hazier on the
// right; the core is the deeper blue that only shows while someone talks; the
// sheen is a pale highlight that sibilance flickers. Each blob's furthest reach
// (lifted, swollen, drifted) stays under the canvas top, which would otherwise
// cut it off in a straight line.
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
  /** 1 normally, 0 with reduced motion: the blob then only brightens. */
  motion: number;
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
    // x and y drift at unrelated rates, so the path never closes on itself.
    const driftX = blob.driftX * width * Math.sin(t);
    const driftY = blob.driftY * height * Math.sin(t * 1.37 + 1.1);
    const breathe = 0.04 * Math.sin(t * 0.71 + 2.3);
    const swell = blob.swell * drive;

    return {
      // Wakes up with the voice as a whole, then follows its band.
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
  /** Loudness drivers from useVoiceLevels. */
  levels: VoiceLevels;
  /** Stop the drift (the voice still moves it). @default false */
  paused?: boolean;
}

/**
 * The voice-reactive glow along the bottom of the voice assistant: idles in a
 * slow drift, and rises, swells and brightens with whoever is talking — the
 * user through the mic, the assistant through its playback envelope.
 */
export const VoiceGlow: React.FC<VoiceGlowProps> = ({
  levels,
  paused = false,
}) => {
  const { colors } = useStyled();
  const windowSize = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  const height = Math.round(windowSize.height * HEIGHT_RATIO);
  // The drawer is as wide as the window, which makes a good first guess; the
  // layout pass then reports the real width.
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

  // Memoised on the shared values it closes over, all stable for the hook's
  // lifetime: useFrameCallback re-registers whenever the callback's identity
  // changes, and the first frame after that has no previous timestamp, so the
  // drift would hitch on every render.
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
    // Overhangs the right edge by one corner so all four corners can share a
    // radius: the bottom-left one is the drawer's, the top two sit where the
    // glow has faded out, and the bottom-right one is off screen. One radius
    // clips with the layer's own corner radius; mixed radii would take a mask
    // layer, re-rendered off screen every frame.
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
