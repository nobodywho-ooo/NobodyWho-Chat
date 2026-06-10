import React from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';
import { ListItem } from 'components';

import styles from './SettingsScreen.styles';

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const navigation = useNavigation();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { backgroundColor: colors.surface }]}
    >
      <ListItem
        title={t('screens.settings.models')}
        subtitle={t('screens.settings.manageYourModels')}
        iosIconName="document.fill"
        androidIconName="article"
        iconBackgroundColor={colors.primary}
        // @ts-ignore
        onPress={() => navigation.navigate('ModelsScreen')}
      />
    </ScrollView>
  );
};
