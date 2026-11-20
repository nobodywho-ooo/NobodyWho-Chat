import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from 'context';
import { colorBetween, haptics, withAlpha } from 'helpers';
import { useStyled } from 'hooks';

import styles, { DOT_SIZE } from './DotMatrixLoader.styles';

const FRAMES: ReadonlyArray<ReadonlyArray<string>> = [
  [
    '........',
    '.1......',
    '....2...',
    '........',
    '..3...1.',
    '........',
    '.....2..',
    '........',
  ],
  [
    '........',
    '........',
    '.#3.....',
    '.##32.1.',
    '.##32.1.',
    '.#3.....',
    '........',
    '........',
  ],
  [
    '........',
    '........',
    '..#3#...',
    '.3###2..',
    '.3###2..',
    '..#3#...',
    '........',
    '........',
  ],
  [
    '........',
    '.......3',
    '1..####.',
    '#2.####.',
    '#2.####.',
    '2..####.',
    '.......3',
    '........',
  ],
  [
    '........',
    '...1....',
    '..2#2...',
    '.2###2..',
    '..2##3..',
    '...2....',
    '........',
    '........',
  ],
  [
    '........',
    '..2##2..',
    '.2....2.',
    '.#....#.',
    '.#....#.',
    '.2....2.',
    '..2##2..',
    '........',
  ],
];

const LEVELS: Record<string, number> = {
  '.': 0,
  '1': 0.3,
  '2': 0.55,
  '3': 0.8,
  '#': 1,
};

const ROWS = FRAMES[0].length;
const COLUMNS = FRAMES[0][0].length;
const FRAME_COUNT = FRAMES.length;

const STEP_MS = 750;
// Share of each step a frame stays still before fading into the next one.
const HOLD = 0.45;
// How many steps later each column starts its fade, so changes sweep left to right.
const COLUMN_DELAY = 0.05;

type HapticKind = 'soft' | 'light';

const FRAME_HAPTICS: ReadonlyArray<HapticKind | null> = [
  null, // sparse
  'soft', // bar
  null, // growing block
  'light', // full block
  null, // diamond
  'soft', // ring
];

const playHaptic = (kind: HapticKind) => haptics[kind]();

/** levels[row][column][frame] */
const DOT_LEVELS: number[][][] = Array.from({ length: ROWS }, (_, row) =>
  Array.from({ length: COLUMNS }, (__, column) =>
    FRAMES.map(frame => LEVELS[frame[row][column]] ?? 0),
  ),
);

interface Palette {
  stops: [string, string, string, string]; /** off → dim → mid → full */
  glow: string;
}

interface DotProps {
  levels: number[];
  column: number;
  clock: SharedValue<number>;
  palette: Palette;
}

const STOP_POSITIONS = [0, 0.35, 0.7, 1];

/** How lit a dot is at `time` (in steps): holds a frame, then eases into the next. */
const levelAt = (levels: number[], time: number): number => {
  'worklet';
  const step = Math.floor(time);
  const from = ((step % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
  const to = (from + 1) % FRAME_COUNT;
  const fade = Math.max(0, (time - step - HOLD) / (1 - HOLD));
  const eased = fade * fade * (3 - 2 * fade);
  return levels[from] + (levels[to] - levels[from]) * eased;
};

const Dot: React.FC<DotProps> = React.memo(
  ({ levels, column, clock, palette }) => {
    const intensity = useAnimatedStyle(() => {
      const level = levelAt(levels, clock.value - column * COLUMN_DELAY);

      return {
        backgroundColor: interpolateColor(level, STOP_POSITIONS, palette.stops),
      };
    });

    const glow = useAnimatedStyle(() => {
      const level = levelAt(levels, clock.value - column * COLUMN_DELAY);

      return { opacity: level * level * level };
    });

    return (
      <View style={styles.cell}>
        <Animated.View style={[styles.glow, glow]}>
          <View
            style={[
              styles.glow,
              {
                backgroundColor: palette.glow,
                boxShadow: `0 0 ${DOT_SIZE * 0.5}px 0px ${palette.glow}`,
              },
            ]}
          />
        </Animated.View>
        <Animated.View style={[styles.dot, intensity]} />
      </View>
    );
  },
);

Dot.displayName = 'Dot';

export const DotMatrixLoader: React.FC = () => {
  const { colors } = useStyled();
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const clock = useSharedValue(0);

  const palette = useMemo<Palette>(() => {
    if (theme === 'light') {
      return {
        stops: [
          colors.surfaceContainer,
          colorBetween(colors.surfaceContainer, colors.tertiary, 0.7),
          colors.secondary,
          colors.primary,
        ],
        glow: withAlpha(colors.secondary, 0.25),
      };
    }
    const hot = colorBetween(colors.tertiary, '#FFFFFF', 0.65);
    return {
      stops: [
        withAlpha(colors.onSurface, 0.1),
        colors.primary,
        colors.secondary,
        hot,
      ],
      glow: withAlpha(colors.secondary, 0.4),
    };
  }, [theme, colors]);

  useAnimatedReaction(
    () => Math.floor(clock.value) % FRAME_COUNT,
    (frame, previous) => {
      if (previous === null || frame === previous) {
        return;
      }
      const kind = FRAME_HAPTICS[frame];
      if (kind) {
        scheduleOnRN(playHaptic, kind);
      }
    },
  );

  useEffect(() => {
    if (reducedMotion) {
      clock.value = 3;
      return;
    }
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(FRAME_COUNT, {
        duration: FRAME_COUNT * STEP_MS,
        easing: Easing.linear,
      }),
      -1,
    );
    return () => cancelAnimation(clock);
  }, [reducedMotion, clock]);

  return (
    <View
      testID="dot-matrix-loader"
      accessibilityRole="progressbar"
      style={styles.grid}
    >
      {DOT_LEVELS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((levels, column) => (
            <Dot
              key={column}
              levels={levels}
              column={column}
              clock={clock}
              palette={palette}
            />
          ))}
        </View>
      ))}
    </View>
  );
};
