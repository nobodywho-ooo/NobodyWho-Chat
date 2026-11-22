import React from 'react';
import LinearGradient from 'react-native-linear-gradient';
import { isLiquidGlassSupported } from '@callstack/liquid-glass';
import { useTheme } from 'context';
import { Theme } from 'types';

import { styles } from '../InputBar.styles';

const gradientColors: Record<Theme, string[]> = {
  light: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.9)'],
  dark: ['rgba(18, 18, 18, 0)', 'rgba(18, 18, 18, 0.9)'],
};

const BOTTOM_FADE_LOCATIONS = [0, 0.25, 0.5, 0.75, 1];
const BOTTOM_FADE_ALPHAS = [0, 0.156, 0.5, 0.844, 1];
const bottomFadeColors: Record<Theme, string[]> = {
  light: BOTTOM_FADE_ALPHAS.map(alpha => `rgba(255, 255, 255, ${alpha})`),
  dark: BOTTOM_FADE_ALPHAS.map(alpha => `rgba(18, 18, 18, ${alpha})`),
};

export const ScrollEdgeFade: React.FC = () => {
  const theme = useTheme();

  if (isLiquidGlassSupported) {
    return (
      <LinearGradient
        pointerEvents="none"
        colors={bottomFadeColors[theme]}
        locations={BOTTOM_FADE_LOCATIONS}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.bottomFade}
      />
    );
  }

  return (
    <LinearGradient
      pointerEvents="none"
      colors={gradientColors[theme]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.topGradient}
    />
  );
};
