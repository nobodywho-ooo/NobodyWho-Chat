import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getVersion, getBuildNumber } from 'react-native-device-info';
import { getIOSVersion, openExternalUrl } from 'helpers';
import { useStyled } from 'hooks';
import { ActionButton, HeaderScrollView, ListItem, Text } from 'components';

import styles from './SettingsScreen.styles';

const ACKNOWLEDGEMENTS_IOS_ICON =
  getIOSVersion() >= 18
    ? 'checkmark.seal.text.page.fill'
    : 'checkmark.seal.fill';

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
    <HeaderScrollView
      style={[styles.container, { backgroundColor: colors.surface }]}
    >
      <Text>{t('screens.settings.app')}</Text>
      <ListItem
        title={t('screens.settings.customize')}
        subtitle={t('screens.settings.customizeSubtitle')}
        iosIconName="slider.horizontal.3"
        androidIconName="tune"
        iconColor={colors.primary}
        // @ts-ignore
        onPress={() => navigation.navigate('CustomizeAssistantScreen')}
      />
      <ListItem
        title={t('screens.settings.language')}
        subtitle={t('screens.settings.languageSubtitle')}
        iosIconName="character.bubble"
        androidIconName="translate"
        iconColor={colors.primary}
        // @ts-ignore
        onPress={() => navigation.navigate('LanguageScreen')}
      />
      <Text style={styles.sectionHeader}>{t('screens.settings.about')}</Text>
      <ListItem
        title={t('screens.settings.terms')}
        subtitle={t('screens.settings.termsSubtitle')}
        iosIconName="doc.text.fill"
        androidIconName="description"
        iconColor={colors.secondary}
        // @ts-ignore
        onPress={() => navigation.navigate('TermsScreen')}
      />
      <ListItem
        title={t('screens.settings.privacyPolicy')}
        subtitle={t('screens.settings.privacyPolicySubtitle')}
        iosIconName="lock.shield.fill"
        androidIconName="privacy_tip"
        iconColor={colors.secondary}
        // @ts-ignore
        onPress={() => navigation.navigate('PrivacyPolicyScreen')}
      />
      <ListItem
        title={t('screens.settings.acknowledgements')}
        subtitle={t('screens.settings.acknowledgementsSubtitle')}
        iosIconName={ACKNOWLEDGEMENTS_IOS_ICON}
        androidIconName="license"
        iconColor={colors.secondary}
        // @ts-ignore
        onPress={() => navigation.navigate('AcknowledgementsScreen')}
      />
      <View style={styles.buttonsContainer}>
        <ActionButton
          label={t('screens.settings.website')}
          onPress={() => openExternalUrl('https://www.nobodywho.ai/')}
        />
        <ActionButton
          label={t('screens.settings.github')}
          onPress={() =>
            openExternalUrl('https://github.com/nobodywho-ooo/nobodywho')
          }
        />
        <ActionButton
          label={t('screens.settings.x')}
          onPress={() => openExternalUrl('https://x.com/nobodywho_ai')}
        />
      </View>
      <Text variant="h3" bold style={styles.appName}>
        NobodyWho Chat
      </Text>
      <Text variant="body2" style={styles.appInfo}>
        {appInfo}
      </Text>
    </HeaderScrollView>
  );
};
