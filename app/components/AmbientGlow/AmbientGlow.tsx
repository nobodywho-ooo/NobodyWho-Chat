import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from 'context';
import { withAlpha } from 'helpers';
import { useStyled } from 'hooks';
import type { Theme } from 'types';

/** centre (% of the width / % down from the top) and radii (% of the width / height). */
interface Glow {
  tone: 'primary' | 'secondary';
  x: number;
  y: number;
  rx: number;
  ry: number;
  alpha: number;
}

const GLOWS: ReadonlyArray<Glow> = [
  { tone: 'primary', x: 30, y: 0, rx: 100, ry: 55, alpha: 0.42 },
  { tone: 'secondary', x: 70, y: 4, rx: 100, ry: 50, alpha: 0.38 },
];

const THEME_STRENGTH: Record<Theme, number> = {
  light: 0.8,
  dark: 0.5,
};

const FALLOFF: ReadonlyArray<readonly [position: number, strength: number]> = [
  [0, 1],
  [35, 0.55],
  [100, 0],
];

const REVEAL_MS = 1000;
const HIDE_MS = 900;

export const AMBIENT_GLOW_HIDE_MS = HIDE_MS;

interface AmbientGlowProps {
  visible: boolean;
}

export const AmbientGlow: React.FC<AmbientGlowProps> = React.memo(
  ({ visible }) => {
    const { colors } = useStyled();
    const theme = useTheme();
    const shown = useSharedValue(0);

    useEffect(() => {
      shown.set(
        withTiming(visible ? 1 : 0, {
          duration: visible ? REVEAL_MS : HIDE_MS,
          easing: Easing.inOut(Easing.quad),
        }),
      );
    }, [visible, shown]);

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: shown.get(),
    }));

    const paint = useMemo<ViewStyle>(
      () => ({
        experimental_backgroundImage: GLOWS.map(glow => ({
          type: 'radial-gradient' as const,
          shape: 'ellipse' as const,
          size: { x: `${glow.rx}%`, y: `${glow.ry}%` },
          position: { left: `${glow.x}%`, top: `${glow.y}%` },
          colorStops: FALLOFF.map(([at, strength]) => ({
            color: withAlpha(
              colors[glow.tone],
              glow.alpha * THEME_STRENGTH[theme] * strength,
            ),
            positions: [`${at}%`],
          })),
        })),
      }),
      [colors, theme],
    );

    return (
      <Animated.View
        testID="ambient-glow"
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, animatedStyle]}
      >
        <View
          style={[StyleSheet.absoluteFill, paint]}
          renderToHardwareTextureAndroid
          shouldRasterizeIOS
        />
      </Animated.View>
    );
  },
);

AmbientGlow.displayName = 'AmbientGlow';
