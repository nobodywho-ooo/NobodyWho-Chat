import React from 'react';
import { Pressable } from 'react-native';
import { useStyled } from 'hooks';
import { Text, fontSizes } from '../Text/Text';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import type { IconButtonIconProps } from '../IconButton/IconButton';

import styles from './SelectablePill.styles';

interface SelectablePillProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Optional platform icon, shown before the label. */
  icon?: IconButtonIconProps;
  /** Defaults to the label's own size, so the two sit on one line. */
  iconSize?: number;
}

// A rounded, tappable chip used for single-select option rows (e.g. TTS voice
// and language). Selected pills fill with the primary colour; unselected ones
// sit on the secondary surface with a hairline border.
export const SelectablePill: React.FC<SelectablePillProps> = ({
  label,
  selected,
  onPress,
  icon,
  iconSize = fontSizes.body1,
}) => {
  const { colors } = useStyled();
  // The icon reads as part of the label, so it takes the label's colour.
  const contentColor = selected ? colors.ctaContentPrimary : colors.onSurface;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: selected
            ? colors.ctaSurfacePrimary
            : colors.surfaceSecondary,
          borderColor: selected ? 'transparent' : colors.border,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      {icon && (
        <PlatformIcon
          iosIconName={icon.iosIconName}
          androidIconName={icon.androidIconName}
          size={iconSize}
          color={contentColor}
        />
      )}
      <Text style={{ color: contentColor }}>{label}</Text>
    </Pressable>
  );
};
