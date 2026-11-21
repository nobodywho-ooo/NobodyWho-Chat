import React from 'react';
import { Pressable } from 'react-native';
import { Text } from 'components';
import { useStyled } from 'hooks';

import styles from './ModelsTabs.styles';

interface TabPillProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export const TabPill: React.FC<TabPillProps> = ({
  label,
  selected,
  onPress,
}) => {
  const { colors } = useStyled();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.pill,
        selected && { backgroundColor: colors.surfaceContainer },
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={{
          color: selected ? colors.onSurface : colors.onSurfaceVariant,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};
