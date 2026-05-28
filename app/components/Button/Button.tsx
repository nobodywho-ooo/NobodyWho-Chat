import React from 'react';
import {
  Pressable,
  PressableProps,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {
  type SFSymbolProps,
  type MaterialSymbolProps,
} from '@react-navigation/native';
import { PlatformIcon } from 'components';
import { useStyled } from 'hooks';
import { ButtonVariant } from 'types';

import { styles, getVariantStyles } from './Button.styles';

interface ButtonIconProps {
  iosIconName: SFSymbolProps['name'];
  androidIconName: MaterialSymbolProps['name'];
}

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: ButtonVariant;
  icon?: ButtonIconProps;
  style?: StyleProp<ViewStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  icon,
  style,
  ...props
}) => {
  const { colors } = useStyled();
  const variantStyle = getVariantStyles(variant, colors);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        variantStyle.button,
        style,
        pressed && { opacity: 0.7 },
      ]}
      android_ripple={{
        color: 'rgba(0,0,0,0.12)',
        foreground: true,
      }}
      {...props}
    >
      <View style={styles.content}>
        {icon && (
          <PlatformIcon
            iosIconName={icon.iosIconName}
            androidIconName={icon.androidIconName}
            color={variantStyle.text.color as string}
          />
        )}
        <Text style={[styles.text, variantStyle.text]}>{title}</Text>
      </View>
    </Pressable>
  );
};
