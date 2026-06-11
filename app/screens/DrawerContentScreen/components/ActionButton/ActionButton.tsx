import React from 'react';
import { Pressable } from 'react-native';
import {
  type SFSymbolProps,
  type MaterialSymbolProps,
} from '@react-navigation/native';
import { PlatformIcon, Text } from 'components';
import { useStyled } from 'hooks';

import styles from './ActionButton.styles';

interface ActionButtonProps {
  icon: {
    iosIconName: SFSymbolProps['name'];
    androidIconName: MaterialSymbolProps['name'];
  };
  label: string;
  onPress: () => void;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  label,
  onPress,
}) => {
  const { colors } = useStyled();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: colors.surfaceContainer },
        pressed && { opacity: 0.6 },
      ]}
    >
      <PlatformIcon
        iosIconName={icon.iosIconName}
        androidIconName={icon.androidIconName}
        color={colors.onSurface}
      />
      <Text variant="body1" style={styles.actionLabel}>
        {label}
      </Text>
    </Pressable>
  );
};
