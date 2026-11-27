import React from 'react';
import {
  ColorValue,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import type { AndroidIconName, IosIconName } from 'types';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import { useStyled } from 'hooks';
import { useTheme } from 'context';

import styles, { iconButtonSize } from './IconButton.styles';

export interface IconButtonIconProps {
  iosIconName: IosIconName;
  androidIconName: AndroidIconName;
}

interface IconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  icon: IconButtonIconProps;
  size?: number;
  color?: string;
  backgroundColor?: string;
  glassTint?: ColorValue;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  size = 20,
  color,
  backgroundColor,
  glassTint,
  compact = false,
  style,
  ...props
}) => {
  const { colors } = useStyled();
  const theme = useTheme();
  const buttonSize = iconButtonSize(compact);
  const shape = {
    width: buttonSize,
    height: buttonSize,
    borderRadius: buttonSize / 2,
  };

  return (
    <Pressable
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        shape,
        !isLiquidGlassSupported && {
          backgroundColor: backgroundColor ?? colors.surfaceContainer,
        },
        pressed && !isLiquidGlassSupported && { opacity: 0.6 },
        style,
      ]}
      {...props}
    >
      {isLiquidGlassSupported && (
        <LiquidGlassView
          interactive
          colorScheme={theme}
          tintColor={glassTint}
          style={[styles.glass, { borderRadius: shape.borderRadius }]}
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
