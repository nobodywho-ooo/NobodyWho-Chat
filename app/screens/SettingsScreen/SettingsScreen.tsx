import React from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useStyled } from 'hooks';
import { ListItem } from 'components';

import styles from './SettingsScreen.styles';

export const SettingsScreen: React.FC = () => {
  const { colors } = useStyled();
  const navigation = useNavigation();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { backgroundColor: colors.surface }]}
    >
      <ListItem
        title="Models"
        subtitle="Manage your models"
        iosIconName="document.fill"
        androidIconName="article"
        iconBackgroundColor="#5856D6"
        // @ts-ignore
        onPress={() => navigation.navigate('EmbeddingsScreen')}
      />
    </ScrollView>
  );
};
