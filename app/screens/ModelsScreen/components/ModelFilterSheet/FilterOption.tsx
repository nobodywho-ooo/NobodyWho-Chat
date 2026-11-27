import React from 'react';
import { Pressable } from 'react-native';
import { PlatformIcon, Text, fontSizes } from 'components';
import type { IconButtonIconProps } from 'components';
import { useStyled } from 'hooks';

import { styles } from './ModelFilterSheet.styles';

interface FilterOptionProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon: IconButtonIconProps;
}

export const FilterOption: React.FC<FilterOptionProps> = ({
  label,
  selected,
  onPress,
  icon,
}) => {
  const { colors } = useStyled();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.option, pressed && styles.pressed]}
    >
      <PlatformIcon
        iosIconName={icon.iosIconName}
        androidIconName={icon.androidIconName}
        size={fontSizes.body1}
        color={selected ? colors.primary : colors.onSurface}
      />
      <Text
        bold={selected}
        style={selected ? { color: colors.primary } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
};
