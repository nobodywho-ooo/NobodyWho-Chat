import { TextStyle } from 'react-native';
import { TextVariant } from 'types';

export const variantStyles: Record<TextVariant, TextStyle> = {
  h1: {
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -1.5,
  },
  h2: {
    fontSize: 28,
    fontWeight: '500',
    letterSpacing: -0.5,
  },
  h3: {
    fontSize: 24,
    fontWeight: '500',
    letterSpacing: 0,
  },
  h4: {
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: 0,
  },
  body1: {
    fontSize: 16,
    fontWeight: '400',
  },
  body2: {
    fontSize: 14,
    fontWeight: '400',
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
  },
};
