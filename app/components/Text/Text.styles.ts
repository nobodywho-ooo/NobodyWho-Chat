import { StyleSheet, TextStyle } from 'react-native';
import { TextVariant } from 'types';

export const fontSizes: Record<TextVariant, number> = {
  h1: 28,
  h2: 24,
  h3: 20,
  h4: 18,
  body1: 16,
  body2: 14,
  caption: 12,
};

export const variantStyles: Record<TextVariant, TextStyle> = {
  h1: {
    fontSize: fontSizes.h1,
    fontWeight: '600',
    letterSpacing: -1.5,
  },
  h2: {
    fontSize: fontSizes.h2,
    fontWeight: '500',
    letterSpacing: -0.5,
  },
  h3: {
    fontSize: fontSizes.h3,
    fontWeight: '500',
    letterSpacing: 0,
  },
  h4: {
    fontSize: fontSizes.h4,
    fontWeight: '500',
    letterSpacing: 0,
  },
  body1: {
    fontSize: fontSizes.body1,
    fontWeight: '400',
  },
  body2: {
    fontSize: fontSizes.body2,
    fontWeight: '400',
  },
  caption: {
    fontSize: fontSizes.caption,
    fontWeight: '400',
  },
};

export const styles = StyleSheet.create({
  bold: {
    fontWeight: '600',
  },
  italic: {
    fontStyle: 'italic',
  },
});
