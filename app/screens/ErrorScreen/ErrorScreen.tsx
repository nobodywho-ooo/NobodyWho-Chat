import React from 'react';
import { View } from 'react-native';
import { useStyled } from 'hooks';
import { Button, Text } from 'components';

import styles from './ErrorScreen.styles';

interface ErrorScreenProps {
  onRetry: () => void;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ onRetry }) => {
  const { colors } = useStyled();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text style={[styles.text, { color: colors.onSurface }]}>
        Something went wrong
      </Text>
      <Button title="Retry" onPress={onRetry} />
    </View>
  );
};
