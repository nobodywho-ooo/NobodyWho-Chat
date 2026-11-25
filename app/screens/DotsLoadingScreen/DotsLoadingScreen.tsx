import React from 'react';
import { View } from 'react-native';
import { useStyled } from 'hooks';

import { BouncingDots } from './components';
import styles from './DotsLoadingScreen.styles';

export const DotsLoadingScreen: React.FC = () => {
  const { colors } = useStyled();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <BouncingDots />
    </View>
  );
};
