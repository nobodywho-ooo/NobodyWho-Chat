import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useStyled } from 'hooks';

import styles from './LoadingScreen.styles';

export const LoadingScreen: React.FC = () => {
  const { colors } = useStyled();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
};
