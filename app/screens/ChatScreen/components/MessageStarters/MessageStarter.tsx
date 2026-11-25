import React from 'react';
import { Pressable } from 'react-native';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import { useTheme } from 'context';
import { useStyled } from 'hooks';
import { Text } from 'components';

import styles from './MessageStarters.styles';

interface MessageStarterProps {
  title: string;
  subtitle: string;
  body: string;
  onPress: (body: string) => void;
  disabled?: boolean;
}

export const MessageStarter: React.FC<MessageStarterProps> = ({
  title,
  subtitle,
  body,
  onPress,
  disabled = false,
}) => {
  const { colors } = useStyled();
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} ${subtitle}`}
      onPress={() => onPress(body)}
      disabled={disabled}
      style={({ pressed }) => [
        styles.starterContainer,
        isLiquidGlassSupported
          ? styles.glassStarter
          : [
              { backgroundColor: colors.surfaceContainer },
              pressed && styles.starterPressed,
            ],
      ]}
    >
      {isLiquidGlassSupported && (
        <LiquidGlassView interactive colorScheme={theme} style={styles.glass} />
      )}
      <Text variant="body2" bold numberOfLines={1}>
        {title}
      </Text>
      <Text
        variant="body2"
        numberOfLines={1}
        style={{ color: colors.onSurfaceVariant }}
      >
        {subtitle}
      </Text>
    </Pressable>
  );
};
