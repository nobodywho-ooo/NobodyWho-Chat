import React from 'react';
import { ScrollView } from 'react-native';
import { useStyled } from 'hooks';
import { ListItem, Text } from 'components';

import styles from './ModelsScreen.styles';

export const ModelsScreen: React.FC = () => {
  const { colors } = useStyled();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { backgroundColor: colors.surface }]}
    >
      <ListItem
        title={'Downloaded'}
        subtitle={'6 models'}
        iosIconName={'arrow.down.circle'}
        androidIconName={'download'}
        iconBackgroundColor="#2ec728"
      />
      <Text variant="h2" style={styles.text}>
        Recommended
      </Text>
    </ScrollView>
  );
};
