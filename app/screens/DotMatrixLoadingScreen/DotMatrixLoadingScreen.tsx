import React from 'react';
import { View } from 'react-native';
import { useStyled } from 'hooks';
import { DotMatrixLoader, Text } from 'components';

import styles from './DotMatrixLoadingScreen.styles';

interface DotMatrixLoadingScreenProps {
  message?: string;
}

export const DotMatrixLoadingScreen: React.FC<DotMatrixLoadingScreenProps> = ({
  message,
}) => {
  const { colors } = useStyled();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <DotMatrixLoader />
      {message ? (
        <Text style={[styles.message, { color: colors.onSurfaceVariant }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
};
