import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getVersion, getBuildNumber } from 'react-native-device-info';
import { log } from 'helpers';
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

  const openURL = (url: string) =>
    Linking.openURL(url).catch(error =>
      log(`Failed to open URL ${url}`, error),
    );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { backgroundColor: colors.surface }]}
    >
      <Text>{t('screens.settings.app')}</Text>
      <ListItem
        title={t('screens.settings.models')}
        subtitle={t('screens.settings.manageYourModels')}
        iosIconName="square.stack.3d.up.fill"
        androidIconName="layers"
        iconBackgroundColor="#5856D6"
        // @ts-ignore
        onPress={() => navigation.navigate('ModelsScreen')}
      />
      <ListItem
        title={t('screens.settings.customize')}
        subtitle={t('screens.settings.customizeSubtitle')}
        iosIconName="slider.horizontal.3"
        androidIconName="tune"
        iconBackgroundColor="#007AFF"
        // @ts-ignore
        onPress={() => navigation.navigate('CustomizeAssistantScreen')}
      />
      <Text style={styles.sectionHeader}>{t('screens.settings.about')}</Text>
      <ListItem
        title={t('screens.settings.terms')}
        subtitle={t('screens.settings.termsSubtitle')}
        iosIconName="doc.text.fill"
        androidIconName="description"
        iconBackgroundColor="#FF9500"
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
      <View style={styles.buttonsContainer}>
        <Button
          title={t('screens.settings.website')}
          variant="outline"
          small
          icon={{ iosIconName: 'globe', androidIconName: 'public' }}
          onPress={() => openURL('https://www.nobodywho.ai/')}
        />
        <Button
          title={t('screens.settings.github')}
          variant="outline"
          small
          icon={{
            iosIconName: 'chevron.left.forwardslash.chevron.right',
            androidIconName: 'code',
          }}
          onPress={() => openURL('https://github.com/nobodywho-ooo/nobodywho')}
        />
      </View>
      <Text variant="h3" bold style={styles.appName}>
        NobodyWho Chat
      </Text>
      <Text variant="body2" style={styles.appInfo}>
        {appInfo}
      </Text>
    </ScrollView>
  );
};
