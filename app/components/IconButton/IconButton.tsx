import React from 'react';
import {
  ColorValue,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {
  type SFSymbolProps,
  type MaterialSymbolProps,
} from '@react-navigation/native';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import { useStyled } from 'hooks';
import { useTheme } from 'context';

import styles from './IconButton.styles';

export interface IconButtonIconProps {
  iosIconName: SFSymbolProps['name'];
  androidIconName: MaterialSymbolProps['name'];
}

interface IconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  icon: IconButtonIconProps;
  size?: number;
  color?: string;
  backgroundColor?: string;
  glass?: boolean;
  glassTint?: ColorValue;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  size = 20,
  color,
  backgroundColor,
  glass = false,
  glassTint,
  compact = false,
  style,
  ...props
}) => {
  const { colors } = useStyled();
  const theme = useTheme();
  const isGlass = glass && isLiquidGlassSupported;

  return (
    <Pressable
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        isGlass
          ? !compact && styles.glassButton
          : { backgroundColor: backgroundColor ?? colors.surfaceContainer },
        pressed && !isGlass && { opacity: 0.6 },
        style,
      ]}
      {...props}
    >
      {isGlass && (
        <LiquidGlassView
          interactive
          colorScheme={theme}
          tintColor={glassTint}
          style={[styles.glass, compact && styles.compactGlass]}
        />
      )}
      <PlatformIcon
        iosIconName={icon.iosIconName}
        androidIconName={icon.androidIconName}
        size={size}
        color={color ?? colors.onSurface}
      />
    </Pressable>
  );
};
