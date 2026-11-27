import React from 'react';
import {
  Pressable,
  PressableProps,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import type { AndroidIconName, IosIconName } from 'types';
import { PlatformIcon } from 'components';
import { useStyled } from 'hooks';
import { ButtonVariant } from 'types';

import { styles, getVariantStyles } from './Button.styles';

interface ButtonIconProps {
  iosIconName: IosIconName;
  androidIconName: AndroidIconName;
}

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: ButtonVariant;
  icon?: ButtonIconProps;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  icon,
  small = false,
  style,
  ...props
}) => {
  const { colors } = useStyled();
  const variantStyle = getVariantStyles(variant, colors);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
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
            size={small ? 16 : 20}
            color={variantStyle.text.color as string}
          />
        )}
        <Text
          style={[styles.text, small && styles.textSmall, variantStyle.text]}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
};
