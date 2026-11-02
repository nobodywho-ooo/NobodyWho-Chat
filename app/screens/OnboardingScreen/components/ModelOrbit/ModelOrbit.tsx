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
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import type { SvgProps } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type FrameInfo,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { haptics, withAlpha } from 'helpers';
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

import EdgeRefractionView from '../../../../../specs/EdgeRefractionViewNativeComponent';

// The arc is a big wheel centred off the left edge: only its right rim shows,
// peaking at RIGHTMOST of the width, with a radius of RADIUS of the height.
// As in the video, the middle disc stops a little short of the edge, close
// enough to reach for it.
const RADIUS = 0.5;
const RIGHTMOST = 0.8;

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

// The intro: the first disc alone for INTRO_DELAY_MS, the others stacked under
// it, then they're dealt out down the wheel to their places, the farther ones
// round through the bottom and back in at the top. Disc 1 settles FIRST_SPAN
// of the way through INTRO_MS, the last disc at the end.
const INTRO_DELAY_MS = 1000;
const INTRO_MS = 2200;
const FIRST_SPAN = 0.35;
// A dealt disc shows as it comes out from under the first one, and a gathered
// one hides as it goes back under the middle one, over this many slots, so a
// stack never lights up the rim.
const EMERGE = 0.35;

// Leaving: the wheel settles on the middle disc as it grows to the largest
// size, so the others can hide under it (GROW_MS), then they all carry on down
// the wheel to the middle and tuck under it (GATHER_MS).
const GROW_MS = 350;
const GATHER_MS = 2000;

// Once the hand lets go, the wheel coasts on for this long at the release
// speed (for picking the disc to settle on), then springs onto it.
const FLING_SECONDS = 0.25;
const SETTLE_SPRING = { damping: 22, stiffness: 180, mass: 1 };

// Auto-rotation waits this long after a drag before taking over again.
const RESUME_MS = 5000;

// Corners close to most phones' screens, so the light at the rim follows them.
const SCREEN_CORNER_RADIUS = 44;

// Neutral glyphs (drawn in currentColor) take a grey disc, and cast grey.
const NEUTRAL_TINT = '#8E8E93';

/** name: the family, shown under the title while its disc is in the middle. */
/** tint: brand colour for the disc, cast onto the rim as it nears it. */
/** solid: the glyph is too pale for a tinted disc (mint on white). */
/** size: relative diameter, so the arc isn't a row of identical coins. */
interface OrbitIcon {
  name: string;
  Icon: FC<SvgProps>;
  tint?: string;
  solid?: boolean;
  size: number;
}

const ICONS: ReadonlyArray<OrbitIcon> = [
  { name: 'Qwen', Icon: qwen, tint: '#6F69F7', size: 1 },
  { name: 'Whisper', Icon: openai, size: 0.84 },
  { name: 'Gemma', Icon: gemma4, tint: '#2E96FF', size: 0.94 },
  { name: 'Ministral', Icon: mistral, tint: '#FA500F', size: 0.8 },
  { name: 'LFM', Icon: liquid, size: 0.92 },
  { name: 'Granite', Icon: ibm, tint: '#1F70C1', size: 1 },
  {
    name: 'Nanbeige',
    Icon: nanbeige,
    tint: '#1E4D3A',
    solid: true,
    size: 0.82,
  },
  { name: 'Supertonic', Icon: supertonic, tint: '#0759F5', size: 0.96 },
  { name: 'Bonsai', Icon: bonsai, size: 0.86 },
  { name: 'MiniCPM', Icon: openbmb, tint: '#315EFF', size: 0.92 },
  { name: 'Silero', Icon: silero, size: 0.8 },
  { name: 'G9', Icon: ai9stars, tint: '#9176C9', size: 0.98 },
  { name: 'NeoHorse', Icon: tokenrhythm, size: 0.88 },
];

const COUNT = ICONS.length;
// Names alone, for the UI thread: ICONS holds components it can't take.
const NAMES = ICONS.map(({ name }) => name);

// Lit from the top left, so a flat logo reads as a little sphere.
const discGradient = (color: string, solid: boolean) =>
  solid
    ? `radial-gradient(circle at 30% 25%, ${withAlpha(color, 0.75)} 0%, ${color} 100%)`
    : `radial-gradient(circle at 30% 25%, ${withAlpha(color, 0.06)} 0%, ${withAlpha(color, 0.3)} 100%)`;

const GRADIENTS = ICONS.map(({ tint = NEUTRAL_TINT, solid = false }) => ({
  disc: discGradient(tint, solid),
  border: withAlpha(tint, solid ? 1 : 0.25),
}));

const TINTS = ICONS.map(({ tint = NEUTRAL_TINT }) => tint);
const LARGEST = Math.max(...ICONS.map(({ size }) => size));

/**
 * Back to front, ending with `top`: the others hide under it, coming out from
 * beneath it in the intro and going back under it when leaving. The farther a
 * disc is dealt in the intro, the deeper it sits.
 */
const layersUnder = (top: number) =>
  Array.from(
    { length: COUNT },
    (_, depth) => (top + COUNT - 1 - depth) % COUNT,
  );

interface Geometry {
  disc: number;
  radius: number;
  centerX: number;
  centerY: number;
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

// Ease-out: a dealt disc leaves fast, as if flung, and settles into place.
const settle = (travel: number) => {
  'worklet';
  return 1 - Math.pow(1 - travel, 3);
};

/** The disc resting on (or nearest) the middle of the wheel. */
const centredIndex = (progress: number) => {
  'worklet';
  return ((-Math.round(progress) % COUNT) + COUNT) % COUNT;
};

/** The wheel's state at a frame; see `Wheel`. */
interface WheelState {
  progress: number;
  breath: number;
  intro: number;
  grow: number;
  gather: number;
  top: number;
}

/** Where disc `index` sits on the wheel right now, and how visible it is. */
const place = (
  index: number,
  size: number,
  geometry: Geometry,
  { progress, breath, intro, grow, gather, top }: WheelState,
) => {
  'worklet';
  const fullness = 0.5 + 0.5 * Math.cos(breath);

  // All the discs start stacked in the middle; through the intro disc `index`
  // travels `index` slots down the wheel to its place, so the last ones go
  // round through the bottom and come back in at the top.
  const span = index === 0 ? 1 : mix(FIRST_SPAN, 1, (index - 1) / (COUNT - 2));
  const dealt = index * settle(clamp01(intro / span));

  // Leaving, every disc carries on down the wheel to the middle, the way it
  // turns: those above straight down, those below out at the bottom and back
  // in from the top. They go together and each stops under the middle disc as
  // it gets there, so they seem to push one another in.
  const distance = (((top - index) % COUNT) + COUNT) % COUNT;
  const gathered = Math.min(gather, distance);

  // Slots run from -COUNT/2 (top) to COUNT/2 (bottom), 0 being the rightmost
  // point, where a whole `progress` lands a disc exactly.
  const slot =
    ((((dealt + gathered + progress + COUNT / 2) % COUNT) + COUNT) % COUNT) -
    COUNT / 2;
  const angle = slot * SPACING * mix(HUDDLED_SPACING, 1, fullness);

  // Fade out over the last slot so the jump from the bottom back to the top
  // never shows, even on a wide screen where the wheel's back is visible.
  const wrap = clamp01(COUNT / 2 - Math.abs(slot));
  const emerged = index === 0 ? 1 : clamp01(dealt / EMERGE);
  const tucked = index === top ? 1 : clamp01((distance - gathered) / EMERGE);

  // The middle disc grows to the largest size before the others gather under it.
  const own = index === top ? mix(size, LARGEST, grow) : size;

  return {
    x: geometry.centerX + geometry.radius * Math.cos(angle),
    y: geometry.centerY + geometry.radius * Math.sin(angle),
    scale: own * mix(HUDDLED_SIZE, 1, fullness),
    visibility: wrap * emerged * tucked,
  };
};

/** progress: where the wheel has turned to, in slots. */
/** intro: the deal-out, 0 to 1. grow: the middle disc growing, 0 to 1. */
/** gather: how many slots the discs have travelled down when leaving. */
/** top: the disc drawn over the others, which they gather under. */
interface Wheel {
  progress: SharedValue<number>;
  breath: SharedValue<number>;
  intro: SharedValue<number>;
  grow: SharedValue<number>;
  gather: SharedValue<number>;
  top: SharedValue<number>;
}

interface OrbitDiscProps {
  index: number;
  geometry: Geometry;
  glyphColor: string;
  backingColor: string;
  wheel: Wheel;
}

const OrbitDisc: React.FC<OrbitDiscProps> = ({
  index,
  geometry,
  glyphColor,
  backingColor,
  wheel,
}) => {
  const { Icon, size } = ICONS[index];
  const gradients = GRADIENTS[index];

  const animatedStyle = useAnimatedStyle(() => {
    const { x, y, scale, visibility } = place(index, size, geometry, {
      progress: wheel.progress.value,
      breath: wheel.breath.value,
      intro: wheel.intro.value,
      grow: wheel.grow.value,
      gather: wheel.gather.value,
      top: wheel.top.value,
    });

    return {
      opacity: visibility,
      transform: [
        { translateX: x - geometry.disc / 2 },
        { translateY: y - geometry.disc / 2 },
        { scale },
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
            // Opaque under the see-through tint, so discs crossing during the
            // deal-out don't show through each other.
            backgroundColor: backingColor,
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

/** The family in the middle before the wheel first turns. */
export const FIRST_CENTERED_NAME = NAMES[centredIndex(0)];

interface ModelOrbitProps {
  /** The family of the disc in the middle, whenever another one takes its place. */
  onCenterChange?: (name: string) => void;
  /** Set to gather the discs back under the middle one, for leaving. */
  gathering?: boolean;
  /** Once they're all under it. */
  onGathered?: () => void;
}

/**
 * Model family logos riding a slow, breathing wheel along the right edge,
 * reaching for the screen's glowing rim as they near it. It opens on the first
 * disc alone, then deals the others out to their places; only then does the
 * wheel start turning and breathing, and take a hand. A vertical drag turns it
 * by hand; it turns itself again RESUME_MS after the hand lets go. Gathering:
 * the middle disc grows, and the others carry on down the wheel and tuck under
 * it.
 */
export const ModelOrbit: React.FC<ModelOrbitProps> = ({
  onCenterChange,
  gathering = false,
  onGathered,
}) => {
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
      disc,
      radius,
      centerX: width * RIGHTMOST - radius,
      centerY: height / 2,
    };
  }, [size]);

  // A drag of one disc's spacing along the arc turns the wheel by one slot.
  const slotLength = SPACING * geometry.radius;

  // `clock` ticks steadily in slots; `progress` is where the discs actually
  // are: resting on a whole slot, then snapping to the next.
  const clock = useSharedValue(0);
  const progress = useSharedValue(0);
  const breath = useSharedValue(0);
  const intro = useSharedValue(reducedMotion ? 1 : 0);
  const [introDone, setIntroDone] = useState(false);
  const grow = useSharedValue(0);
  const gather = useSharedValue(0);
  const top = useSharedValue(0);
  const leaving = useSharedValue(false);

  const wheel = useMemo<Wheel>(
    () => ({ progress, breath, intro, grow, gather, top }),
    [progress, breath, intro, grow, gather, top],
  );

  // Drawn under the top disc; the native side reads the discs, and so their
  // colours, in this order.
  const [topIndex, setTopIndex] = useState(0);
  const layers = useMemo(() => layersUnder(topIndex), [topIndex]);
  const tints = useMemo(() => layers.map(index => TINTS[index]), [layers]);

  // While a finger is on the wheel, and how long auto-rotation still waits
  // after it lifted.
  const dragging = useSharedValue(false);
  const resumeIn = useSharedValue(0);
  const dragStart = useSharedValue(0);

  const onFrame = useCallback(
    (info: FrameInfo) => {
      'worklet';
      let dt = info.timeSincePreviousFrame ?? 0;
      if (dt > MAX_DT_MS) dt = MAX_DT_MS;
      const seconds = dt / 1000;

      // Still dealing the discs out, or gathering them back: nothing turns or
      // breathes on its own.
      if (intro.value < 1 || leaving.value) return;

      breath.value += (seconds / BREATH_SECONDS) * 2 * Math.PI;

      if (dragging.value) return;
      if (resumeIn.value > 0) {
        resumeIn.value -= dt;
        // Pick the steady tick up from the disc the hand left in the middle.
        if (resumeIn.value <= 0) clock.value = Math.round(progress.value);
        return;
      }

      clock.value += seconds / SLOT_SECONDS;

      const whole = Math.floor(clock.value);
      const travel = clamp01(
        (clock.value - whole - SNAP_HOLD) / (1 - SNAP_HOLD),
      );
      progress.value = whole + snap(travel);
    },
    [clock, progress, breath, intro, leaving, dragging, resumeIn],
  );

  const frame = useFrameCallback(onFrame, false);

  useEffect(() => {
    frame.setActive(!reducedMotion);
    return () => frame.setActive(false);
  }, [frame, reducedMotion]);

  useEffect(() => {
    intro.value = reducedMotion
      ? 1
      : withDelay(
          INTRO_DELAY_MS,
          withTiming(1, { duration: INTRO_MS, easing: Easing.linear }, done => {
            if (done) scheduleOnRN(setIntroDone, true);
          }),
        );
  }, [intro, reducedMotion]);

  // A heavy knock the moment the stack breaks and the deal-out starts.
  const knock = useCallback(() => haptics.heavy(), []);

  useAnimatedReaction(
    () => intro.value > 0 && intro.value < 1,
    (dealing, wasDealing) => {
      if (dealing && wasDealing === false) scheduleOnRN(knock);
    },
    [knock],
  );

  useEffect(() => {
    if (!gathering || leaving.value) return;
    if (reducedMotion) {
      onGathered?.();
      return;
    }
    leaving.value = true;
    dragging.value = false;

    // Settle on the disc nearest the middle: the others gather under it, so it
    // goes on top. A deal-out still running finishes on the way.
    cancelAnimation(progress);
    const settled = Math.round(progress.value);
    const middle = centredIndex(settled);
    top.value = middle;
    setTopIndex(middle);

    const growing = { duration: GROW_MS, easing: Easing.out(Easing.cubic) };
    progress.value = withTiming(settled, growing);
    intro.value = withTiming(1, growing);
    grow.value = withTiming(1, growing);
    // Back to full size and spacing, where the breath starts.
    breath.value = withTiming(
      Math.round(breath.value / (2 * Math.PI)) * 2 * Math.PI,
      growing,
    );

    // Gathering speed all the way: the last discs rush in.
    gather.value = withDelay(
      GROW_MS,
      withTiming(
        COUNT - 1,
        { duration: GATHER_MS, easing: Easing.in(Easing.quad) },
        done => {
          if (done && onGathered) scheduleOnRN(onGathered);
        },
      ),
    );
  }, [
    gathering,
    onGathered,
    reducedMotion,
    leaving,
    dragging,
    progress,
    top,
    intro,
    grow,
    breath,
    gather,
  ]);

  const pan = usePanGesture({
    // No hand on the wheel until every disc is in place, nor once leaving.
    enabled: (introDone || reducedMotion) && !gathering,
    activeOffsetY: [-8, 8],
    onActivate: () => {
      cancelAnimation(progress);
      dragging.value = true;
      dragStart.value = progress.value;
    },
    onUpdate: event => {
      progress.value = dragStart.value + event.translationY / slotLength;
    },
    onDeactivate: event => {
      const velocity = event.velocityY / slotLength;
      const target = Math.round(progress.value + velocity * FLING_SECONDS);
      progress.value = withSpring(target, { ...SETTLE_SPRING, velocity });
      dragging.value = false;
      resumeIn.value = RESUME_MS;
    },
  });

  // A tick each time a disc passes the middle, by hand or on its own; not
  // for the one that's there to begin with.
  const handleCenterChange = useCallback(
    (index: number, passed: boolean) => {
      if (passed) haptics.medium();
      onCenterChange?.(NAMES[index]);
    },
    [onCenterChange],
  );

  useAnimatedReaction(
    () => centredIndex(progress.value),
    (index, previous) => {
      if (index !== previous) {
        scheduleOnRN(handleCenterChange, index, previous !== null);
      }
    },
    [handleCenterChange],
  );

  const onLayout = useCallback(
    ({ nativeEvent: { layout } }: LayoutChangeEvent) =>
      setSize({ width: layout.width, height: layout.height }),
    [],
  );

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.orbitContainer} onLayout={onLayout}>
        <EdgeRefractionView
          discColors={tints}
          surfaceColor={colors.surface}
          cornerRadius={SCREEN_CORNER_RADIUS}
          pointerEvents="none"
          style={styles.lensContainer}
        >
          {layers.map(index => (
            <OrbitDisc
              key={index}
              index={index}
              geometry={geometry}
              glyphColor={colors.onSurface}
              backingColor={colors.surface}
              wheel={wheel}
            />
          ))}
        </EdgeRefractionView>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  orbitContainer: {
    ...StyleSheet.absoluteFill,
  },
  lensContainer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
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
});
