import React from 'react';
import { View } from 'react-native';
import { Button } from '../Button/Button';
import { Text } from '../Text/Text';

import styles from './ErrorView.styles';

interface ErrorViewProps {
  message: string;
  onRetry: () => void;
}

export const ErrorView: React.FC<ErrorViewProps> = ({ message, onRetry }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
      <Button title="Retry" onPress={onRetry} />
    </View>
  );
};
