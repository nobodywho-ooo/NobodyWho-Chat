import React, { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { withAlpha } from 'helpers';
import { useStyled } from 'hooks';

type Edge = 'top' | 'bottom';

/** centre (% of the width / % from the edge) and radii (% of the width / height). */
interface Glow {
  tone: 'primary' | 'secondary' | 'tertiary';
  x: number;
  y: number;
  rx: number;
  ry: number;
  alpha: number;
}

const GLOWS: ReadonlyArray<Glow> = [
  { tone: 'primary', x: 15, y: 0, rx: 85, ry: 45, alpha: 0.45 },
  { tone: 'tertiary', x: 55, y: 7, rx: 70, ry: 38, alpha: 0.35 },
  { tone: 'secondary', x: 92, y: 14, rx: 70, ry: 36, alpha: 0.4 },
];

const FALLOFF: ReadonlyArray<readonly [position: number, strength: number]> = [
  [0, 1],
  [35, 0.55],
  [100, 0],
];

interface AmbientGlowProps {
  edge: Edge;
}

export const AmbientGlow: React.FC<AmbientGlowProps> = React.memo(
  ({ edge }) => {
    const { colors } = useStyled();

    const style = useMemo<ViewStyle>(
      () => ({
        experimental_backgroundImage: GLOWS.map(glow => ({
          type: 'radial-gradient' as const,
          shape: 'ellipse' as const,
          size: { x: `${glow.rx}%`, y: `${glow.ry}%` },
          position:
            edge === 'top'
              ? { left: `${glow.x}%`, top: `${glow.y}%` }
              : { left: `${glow.x}%`, bottom: `${glow.y}%` },
          colorStops: FALLOFF.map(([at, strength]) => ({
            color: withAlpha(colors[glow.tone], glow.alpha * strength),
            positions: [`${at}%`],
          })),
        })),
      }),
      [edge, colors],
    );

    return (
      <View
        testID="ambient-glow"
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, style]}
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
      />
    );
  },
);

AmbientGlow.displayName = 'AmbientGlow';
