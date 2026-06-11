import React, { useEffect, useState } from 'react';
import { Linking, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getVersion, getBuildNumber } from 'react-native-device-info';
import { useStyled } from 'hooks';
import { Button, ListItem, Text } from 'components';

import styles from './SettingsScreen.styles';

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const navigation = useNavigation();
  const [appInfo, setAppInfo] = useState('');

  useEffect(() => {
    const version = getVersion();
    const buildNumber = getBuildNumber();

    setAppInfo(`version ${version} - build ${buildNumber}`);
  }, []);

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
      <Button
        title={t('screens.settings.website')}
        variant="outline"
        icon={{ iosIconName: 'globe', androidIconName: 'public' }}
        style={styles.websiteButton}
        onPress={() => Linking.openURL('https://www.nobodywho.ai/')}
      />
      <Text variant="h3" bold style={styles.appName}>
        NobodyWho Chat
      </Text>
      <Text variant="body2" style={styles.appInfo}>
        {appInfo}
      </Text>
    </ScrollView>
  );
};
