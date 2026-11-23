import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStyled } from 'hooks';
import { haptics } from 'helpers';
import { Spacings } from 'style';

import { Text } from '../../Text/Text';

interface ChoiceButtonsProps {
  /** The choices the model offered, in order. */
  choices: string[];
  /** Sends the tapped choice as a user message. */
  onSendText: (text: string) => void;
}

export const ChoiceButtons: React.FC<ChoiceButtonsProps> = ({
  choices,
  onSendText,
}) => {
  const { colors } = useStyled();

  return (
    <View style={styles.container}>
      {choices.map((choice, index) => (
        <Pressable
          key={`${index}-${choice}`}
          accessibilityRole="button"
          accessibilityLabel={choice}
          onPress={() => {
            haptics.light();
            onSendText(choice);
          }}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.surface,
              borderColor: colors.primary,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text
            variant="body2"
            style={[styles.label, { color: colors.primary }]}
          >
            {choice}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacings.xs,
    columnGap: Spacings.sm,
    marginBottom: Spacings.md,
  },
  button: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: Spacings.lg,
    paddingVertical: Spacings.xs,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    includeFontPadding: false,
  },
});
