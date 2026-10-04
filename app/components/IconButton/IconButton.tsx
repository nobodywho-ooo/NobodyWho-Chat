import React from 'react';
import { Pressable, PressableProps } from 'react-native';
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
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  size = 20,
  color,
  backgroundColor,
  glass = false,
  ...props
}) => {
  const { colors } = useStyled();
  const isGlass = glass && isLiquidGlassSupported;

  return (
    <Pressable
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        isGlass
          ? styles.glassButton
          : { backgroundColor: backgroundColor ?? colors.surfaceContainer },
        pressed && !isGlass && { opacity: 0.6 },
      ]}
      {...props}
    >
      {isGlass && <LiquidGlassView interactive style={styles.glass} />}
      <PlatformIcon
        iosIconName={icon.iosIconName}
        androidIconName={icon.androidIconName}
        size={size}
        color={color ?? colors.onSurface}
      />
    </Pressable>
  );
};
