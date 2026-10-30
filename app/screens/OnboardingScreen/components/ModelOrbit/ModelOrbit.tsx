import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
} from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import type { SvgProps } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type FrameInfo,
  type SharedValue,
} from 'react-native-reanimated';
import { withAlpha } from 'helpers';
import { useStyled } from 'hooks';
import {
  ai9stars,
  bonsai,
  gemma4,
  ibm,
  liquid,
  mistral,
  nanbeige,
  openai,
  openbmb,
  qwen,
  silero,
  supertonic,
  tokenrhythm,
} from 'svg';

// The arc is a big wheel centred off the left edge: only its right rim shows,
// peaking at RIGHTMOST of the width, with a radius of RADIUS of the height.
const RADIUS = 0.5;
const RIGHTMOST = 0.86;

// Disc diameter, capped by the height so tablets don't get saucers.
const DISC_WIDTH = 0.24;
const DISC_HEIGHT = 0.11;
const GLYPH = 0.5;

// Angle between two discs at full size; it tightens with the breath.
const SPACING = (22 * Math.PI) / 180;

// Seconds for the wheel to move on by one disc, and for one breath in and out.
const SLOT_SECONDS = 2.4;
const BREATH_SECONDS = 7;

// Share of each slot a disc rests in the middle before the wheel moves on; the
// rest is the eased travel to the next disc. Higher SHARPNESS = harder snap.
const SNAP_HOLD = 0.2;
const SNAP_SHARPNESS = 4;

// At the bottom of the breath the discs shrink and huddle together around the
// middle one, which stays put.
const HUDDLED_SIZE = 0.78;
const HUDDLED_SPACING = 0.84;

// Same delta clamp as VoiceGlow: a hitch advances the wheel, not jumps it
const MAX_DT_MS = 100;

const ENTRANCE_MS = 1200;
// Fraction of the entrance spent cascading from the top disc to the bottom one.
const ENTRANCE_STAGGER = 0.4;

// The glow on the right edge lights up as a disc comes within REACH of the
// width from it, like light caught in the screen's rim.
const GLOW_REACH = 0.35;
const GLOW_PEAK = 0.6;
const GLOW_WIDTH = 0.2;
const GLOW_HEIGHT = 1.7;

// Neutral glyphs (drawn in currentColor) take a grey disc and glow.
const NEUTRAL_TINT = '#8E8E93';

// Radial falloff (1 − t²)², as in VoiceGlow: a soft shoulder, no rim.
const FALLOFF: ReadonlyArray<readonly [position: number, alpha: number]> = [
  [0, 1],
  [20, 0.92],
  [40, 0.71],
  [60, 0.41],
  [80, 0.13],
  [100, 0],
];

/** tint: brand colour for the disc and its glow; none for currentColor glyphs. */
/** solid: the glyph is too pale for a tinted disc (mint on white). */
/** size: relative diameter, so the arc isn't a row of identical coins. */
interface OrbitIcon {
  Icon: FC<SvgProps>;
  tint?: string;
  solid?: boolean;
  size: number;
}

const ICONS: ReadonlyArray<OrbitIcon> = [
  { Icon: qwen, tint: '#6F69F7', size: 1 },
  { Icon: openai, size: 0.84 },
  { Icon: gemma4, tint: '#2E96FF', size: 0.94 },
  { Icon: mistral, tint: '#FA500F', size: 0.8 },
  { Icon: liquid, size: 0.92 },
  { Icon: ibm, tint: '#1F70C1', size: 1 },
  { Icon: nanbeige, tint: '#1E4D3A', solid: true, size: 0.82 },
  { Icon: supertonic, tint: '#0759F5', size: 0.96 },
  { Icon: bonsai, size: 0.86 },
  { Icon: openbmb, tint: '#315EFF', size: 0.92 },
  { Icon: silero, size: 0.8 },
  { Icon: ai9stars, tint: '#9176C9', size: 0.98 },
  { Icon: tokenrhythm, size: 0.88 },
];

const COUNT = ICONS.length;

const glowGradient = (color: string) =>
  `radial-gradient(closest-side, ${FALLOFF.map(
    ([position, alpha]) =>
      `${withAlpha(color, alpha * GLOW_PEAK)} ${position}%`,
  ).join(', ')})`;

// Lit from the top left, so a flat logo reads as a little sphere.
const discGradient = (color: string, solid: boolean) =>
  solid
    ? `radial-gradient(circle at 30% 25%, ${withAlpha(color, 0.75)} 0%, ${color} 100%)`
    : `radial-gradient(circle at 30% 25%, ${withAlpha(color, 0.06)} 0%, ${withAlpha(color, 0.3)} 100%)`;

const GRADIENTS = ICONS.map(({ tint = NEUTRAL_TINT, solid = false }) => ({
  disc: discGradient(tint, solid),
  border: withAlpha(tint, solid ? 1 : 0.25),
  glow: glowGradient(tint),
}));

interface Geometry {
  width: number;
  disc: number;
  radius: number;
  centerX: number;
  centerY: number;
  glowWidth: number;
  glowHeight: number;
}

const mix = (from: number, to: number, amount: number) => {
  'worklet';
  return from + (to - from) * amount;
};

const clamp01 = (value: number) => {
  'worklet';
  return Math.min(1, Math.max(0, value));
};

// Ease-in-out: the wheel picks up speed between slots and brakes hard as the
// next disc nears the middle, so it settles there instead of sliding past.
const snap = (travel: number) => {
  'worklet';
  return travel < 0.5
    ? Math.pow(2 * travel, SNAP_SHARPNESS) / 2
    : 1 - Math.pow(2 - 2 * travel, SNAP_SHARPNESS) / 2;
};

/** Where disc `index` sits on the wheel right now, and how visible it is. */
const place = (
  index: number,
  progress: number,
  breath: number,
  entrance: number,
  size: number,
  geometry: Geometry,
) => {
  'worklet';
  const fullness = 0.5 + 0.5 * Math.cos(breath);
  // Slots run from -COUNT/2 (top) to COUNT/2 (bottom), 0 being the rightmost
  // point, where a whole `progress` lands a disc exactly.
  const slot =
    ((((index + progress + COUNT / 2) % COUNT) + COUNT) % COUNT) - COUNT / 2;
  const angle = slot * SPACING * mix(HUDDLED_SPACING, 1, fullness);

  // Fade out over the last slot so the jump from the bottom back to the top
  // never shows, even on a wide screen where the wheel's back is visible.
  const wrap = clamp01(COUNT / 2 - Math.abs(slot));
  const delay = ((slot + COUNT / 2) / COUNT) * ENTRANCE_STAGGER;
  const arrival = clamp01((entrance - delay) / (1 - ENTRANCE_STAGGER));

  return {
    x: geometry.centerX + geometry.radius * Math.cos(angle),
    y: geometry.centerY + geometry.radius * Math.sin(angle),
    scale: size * mix(HUDDLED_SIZE, 1, fullness),
    visibility: wrap * arrival,
    arrival,
  };
};

interface OrbitItemProps {
  index: number;
  geometry: Geometry;
  progress: SharedValue<number>;
  breath: SharedValue<number>;
  entrance: SharedValue<number>;
}

const OrbitGlow: React.FC<OrbitItemProps> = ({
  index,
  geometry,
  progress,
  breath,
  entrance,
}) => {
  const { size } = ICONS[index];

  const animatedStyle = useAnimatedStyle(() => {
    const { x, y, scale, visibility } = place(
      index,
      progress.value,
      breath.value,
      entrance.value,
      size,
      geometry,
    );
    const reach = GLOW_REACH * geometry.width;
    const rim = x + (geometry.disc / 2) * scale;
    const proximity = clamp01((rim - (geometry.width - reach)) / reach);

    return {
      opacity: proximity * proximity * visibility,
      transform: [
        { translateY: y - geometry.glowHeight / 2 },
        { scaleY: scale },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.glowContainer,
        {
          left: geometry.width - geometry.glowWidth / 2,
          width: geometry.glowWidth,
          height: geometry.glowHeight,
        },
        animatedStyle,
      ]}
    >
      <View
        style={[
          styles.fillContainer,
          { experimental_backgroundImage: GRADIENTS[index].glow },
        ]}
      />
    </Animated.View>
  );
};

interface OrbitDiscProps extends OrbitItemProps {
  glyphColor: string;
}

const OrbitDisc: React.FC<OrbitDiscProps> = ({
  index,
  geometry,
  glyphColor,
  progress,
  breath,
  entrance,
}) => {
  const { Icon, size } = ICONS[index];
  const gradients = GRADIENTS[index];

  const animatedStyle = useAnimatedStyle(() => {
    const { x, y, scale, visibility, arrival } = place(
      index,
      progress.value,
      breath.value,
      entrance.value,
      size,
      geometry,
    );

    return {
      opacity: visibility,
      transform: [
        { translateX: x - geometry.disc / 2 },
        { translateY: y - geometry.disc / 2 },
        { scale: scale * mix(0.6, 1, arrival) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.discContainer,
        { width: geometry.disc, height: geometry.disc },
        animatedStyle,
      ]}
    >
      <View
        style={[
          styles.faceContainer,
          {
            borderRadius: geometry.disc / 2,
            borderColor: gradients.border,
            experimental_backgroundImage: gradients.disc,
          },
        ]}
      >
        <Icon
          width={geometry.disc * GLYPH}
          height={geometry.disc * GLYPH}
          color={glyphColor}
        />
      </View>
    </Animated.View>
  );
};

/** Model family logos riding a slow, breathing wheel along the right edge. */
export const ModelOrbit: React.FC = () => {
  const { colors } = useStyled();
  const windowSize = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  const [size, setSize] = useState({
    width: windowSize.width,
    height: windowSize.height,
  });

  const geometry = useMemo<Geometry>(() => {
    const { width, height } = size;
    const disc = Math.min(width * DISC_WIDTH, height * DISC_HEIGHT);
    const radius = height * RADIUS;

    return {
      width,
      disc,
      radius,
      centerX: width * RIGHTMOST - radius,
      centerY: height / 2,
      glowWidth: width * GLOW_WIDTH,
      glowHeight: disc * GLOW_HEIGHT,
    };
  }, [size]);

  // `clock` ticks steadily in slots; `progress` is where the discs actually
  // are: resting on a whole slot, then snapping to the next.
  const clock = useSharedValue(0);
  const progress = useSharedValue(0);
  const breath = useSharedValue(0);
  const entrance = useSharedValue(reducedMotion ? 1 : 0);

  const onFrame = useCallback(
    (info: FrameInfo) => {
      'worklet';
      let dt = info.timeSincePreviousFrame ?? 0;
      if (dt > MAX_DT_MS) dt = MAX_DT_MS;
      const seconds = dt / 1000;

      breath.value += (seconds / BREATH_SECONDS) * 2 * Math.PI;
      clock.value += seconds / SLOT_SECONDS;

      const whole = Math.floor(clock.value);
      const travel = clamp01(
        (clock.value - whole - SNAP_HOLD) / (1 - SNAP_HOLD),
      );
      progress.value = whole + snap(travel);
    },
    [clock, progress, breath],
  );

  const frame = useFrameCallback(onFrame, false);

  useEffect(() => {
    frame.setActive(!reducedMotion);
    return () => frame.setActive(false);
  }, [frame, reducedMotion]);

  useEffect(() => {
    entrance.value = reducedMotion
      ? 1
      : withTiming(1, {
          duration: ENTRANCE_MS,
          easing: Easing.out(Easing.cubic),
        });
  }, [entrance, reducedMotion]);

  const onLayout = useCallback(
    ({ nativeEvent: { layout } }: LayoutChangeEvent) =>
      setSize({ width: layout.width, height: layout.height }),
    [],
  );

  return (
    <View
      pointerEvents="none"
      style={styles.orbitContainer}
      onLayout={onLayout}
    >
      {/* Every glow under every disc, so a glow never tints a neighbour. */}
      {ICONS.map((_, index) => (
        <OrbitGlow
          key={index}
          index={index}
          geometry={geometry}
          progress={progress}
          breath={breath}
          entrance={entrance}
        />
      ))}
      {ICONS.map((_, index) => (
        <OrbitDisc
          key={index}
          index={index}
          geometry={geometry}
          glyphColor={colors.onSurface}
          progress={progress}
          breath={breath}
          entrance={entrance}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  orbitContainer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  glowContainer: {
    position: 'absolute',
    top: 0,
  },
  discContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  faceContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  fillContainer: {
    flex: 1,
  },
});
