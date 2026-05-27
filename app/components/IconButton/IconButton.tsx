import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
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
  style?: StyleProp<ViewStyle>;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  size = 20,
  style,
  ...props
}) => {
  const { colors } = useStyled();

  return (
    <Pressable
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.surfaceContainer },
        style,
        pressed && { opacity: 0.6 },
      ]}
      {...props}
    >
      <PlatformIcon
        iosIconName={icon.iosIconName}
        androidIconName={icon.androidIconName}
        size={size}
        color={colors.onSurface}
      />
    </Pressable>
  );
};
