import React from 'react';
import { View } from 'react-native';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import { useTheme } from 'context';

const GlassCard: React.FC<React.ComponentProps<typeof View>> = props => {
  const theme = useTheme();

  return <LiquidGlassView colorScheme={theme} {...props} />;
};

export const Card = isLiquidGlassSupported ? GlassCard : View;
