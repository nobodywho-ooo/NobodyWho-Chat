import React from 'react';
import { View } from 'react-native';
import { useStyled } from 'hooks';
import { Text } from 'components';

import styles from './ModelsScreen.styles';

export const ModelsScreen: React.FC = () => {
  const { colors } = useStyled();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text style={[styles.text, { color: colors.onSurface }]}>Models</Text>
    </View>
  );
};
