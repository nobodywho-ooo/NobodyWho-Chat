import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useStyled } from 'hooks';
import { Text } from 'components';

import styles from './LoadingScreen.styles';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => {
  const { colors } = useStyled();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? (
        <Text style={[styles.message, { color: colors.onSurfaceVariant }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
};
