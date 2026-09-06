import React from 'react';
import { Pressable } from 'react-native';
import { useStyled } from 'hooks';
import { Text } from '../Text/Text';

import styles from './SelectablePill.styles';

interface SelectablePillProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

// A rounded, tappable chip used for single-select option rows (e.g. TTS voice
// and language). Selected pills fill with the primary colour; unselected ones
// sit on the secondary surface with a hairline border.
export const SelectablePill: React.FC<SelectablePillProps> = ({
  label,
  selected,
  onPress,
}) => {
  const { colors } = useStyled();

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
      <Text
        style={{
          color: selected ? colors.ctaContentPrimary : colors.onSurface,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};
