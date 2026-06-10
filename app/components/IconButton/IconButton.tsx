import React from 'react';
import { Pressable, PressableProps } from 'react-native';
import {
  type SFSymbolProps,
  type MaterialSymbolProps,
} from '@react-navigation/native';
import { PlatformIcon } from 'components';
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
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  size = 20,
  color,
  backgroundColor,
  ...props
}) => {
  const { colors } = useStyled();

  return (
    <Pressable
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: backgroundColor ?? colors.surfaceContainer },
        pressed && { opacity: 0.6 },
      ]}
      {...props}
    >
      <PlatformIcon
        iosIconName={icon.iosIconName}
        androidIconName={icon.androidIconName}
        size={size}
        color={color ?? colors.onSurface}
      />
    </Pressable>
  );
};
