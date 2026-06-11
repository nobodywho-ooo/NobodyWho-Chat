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
        iosIconName="square.stack.3d.up.fill"
        androidIconName="layers"
        iconBackgroundColor="#FF9500"
        // @ts-ignore
        onPress={() => navigation.navigate('ModelsScreen')}
      />
      <ListItem
        title={t('screens.settings.terms')}
        subtitle={t('screens.settings.termsSubtitle')}
        iosIconName="doc.text.fill"
        androidIconName="description"
        iconBackgroundColor="#5856D6"
        // @ts-ignore
        onPress={() => navigation.navigate('TermsScreen')}
      />
      <ListItem
        title={t('screens.settings.privacyPolicy')}
        subtitle={t('screens.settings.privacyPolicySubtitle')}
        iosIconName="lock.shield.fill"
        androidIconName="privacy_tip"
        iconBackgroundColor="#34C759"
        // @ts-ignore
        onPress={() => navigation.navigate('PrivacyPolicyScreen')}
      />
    </ScrollView>
  );
};
