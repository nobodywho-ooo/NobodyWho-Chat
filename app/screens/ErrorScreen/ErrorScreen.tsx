import React from 'react';
import { View } from 'react-native';
import { useStyled } from 'hooks';
import { ErrorView } from 'components';

import styles from './ErrorScreen.styles';

interface ErrorScreenProps {
  onRetry: () => void;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ onRetry }) => {
  const { colors } = useStyled();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <ErrorView message="Something went wrong" onRetry={onRetry} />
    </View>
  );
};
