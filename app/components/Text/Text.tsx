import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { useStyled } from 'hooks';
import { TextVariant } from 'types';

import { variantStyles } from './Text.styles';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  bold?: boolean;
  italic?: boolean;
}

export const Text: React.FC<TextProps> = ({
  variant = 'body1',
  bold,
  italic,
  style,
  ...props
}) => {
  const { colors } = useStyled();

  return (
    <RNText
      style={[
        { color: colors.onSurface },
        variantStyles[variant],
        bold && { fontWeight: '600' },
        italic && { fontStyle: 'italic' },
        style,
      ]}
      {...props}
    />
  );
};
