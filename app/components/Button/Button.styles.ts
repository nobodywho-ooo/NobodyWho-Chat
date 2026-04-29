import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { ButtonVariant } from 'types';

interface ButtonVariantStyle {
  button: ViewStyle;
  text: TextStyle;
}

export const getVariantStyles = (
  variant: ButtonVariant,
  colors: {
    primary: string;
    border: string;
    surface: string;
    onSurface: string;
  },
): ButtonVariantStyle => {
  switch (variant) {
    case 'primary':
      return {
        button: {
          backgroundColor: colors.primary,
        },
        text: {
          color: '#FFFFFF',
        },
      };
    case 'outline':
      return {
        button: {
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: colors.border,
        },
        text: {
          color: colors.onSurface,
        },
      };
  }
};

export const styles = StyleSheet.create({
  button: {
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
