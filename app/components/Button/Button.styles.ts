import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { ButtonVariant } from 'types';
import { NWColors } from 'style';

interface ButtonVariantStyle {
  button: ViewStyle;
  text: TextStyle;
}

export const getVariantStyles = (
  variant: ButtonVariant,
  colors: NWColors,
): ButtonVariantStyle => {
  switch (variant) {
    case 'primary':
      return {
        button: {
          backgroundColor: colors.ctaSurfacePrimary,
        },
        text: {
          color: colors.ctaContentPrimary,
        },
      };
    case 'outline':
      return {
        button: {
          backgroundColor: colors.ctaSurfaceOutline,
          borderWidth: 1.5,
          borderColor: colors.ctaBorderOutline,
        },
        text: {
          color: colors.ctaContentOutline,
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
