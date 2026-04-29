import React from 'react';
import {
  Pressable,
  PressableProps,
  StyleProp,
  Text,
  ViewStyle,
} from 'react-native';
import { useStyled } from 'hooks';
import { ButtonVariant } from 'types';

import { styles, getVariantStyles } from './Button.styles';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
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
      <Text style={[styles.text, variantStyle.text]}>{title}</Text>
    </Pressable>
  );
};
