import React, { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getVersion, getBuildNumber } from 'react-native-device-info';
import {
  FEEDBACK_EMAIL,
  getIOSVersion,
  openExternalUrl,
  openFeedbackEmail,
} from 'helpers';
import { useStyled } from 'hooks';
import { HeaderScrollView, ListItem, Text } from 'components';
import { Spacings } from 'style';
import { Routes } from 'navigation';

import { LinksSheet } from './components/LinksSheet/LinksSheet';
import styles from './SettingsScreen.styles';

const ACKNOWLEDGEMENTS_IOS_ICON =
  getIOSVersion() >= 18
    ? 'checkmark.seal.text.page.fill'
    : 'checkmark.seal.fill';

const RATE_APP_URL = Platform.select({
  ios: 'https://apps.apple.com/app/id6781001350?action=write-review',
  default: 'https://play.google.com/store/apps/details?id=ai.nobodywho.mobile',
});

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const [appInfo, setAppInfo] = useState('');
  const [linksVisible, setLinksVisible] = useState(false);

  useEffect(() => {
    const version = getVersion();
    const buildNumber = getBuildNumber();

    setAppInfo(`version ${version} • build ${buildNumber}`);
  }, []);

  const sendFeedback = async () => {
    if (await openFeedbackEmail()) {
      return;
    }
    Alert.alert(
      t('screens.settings.feedbackUnavailableTitle'),
      t('screens.settings.feedbackUnavailableMessage', {
        email: FEEDBACK_EMAIL,
      }),
    );
  };

  return (
    <HeaderScrollView
      style={[styles.container, { backgroundColor: colors.surface }]}
      contentContainerStyle={{ paddingBottom: Spacings.xl }}
    >
      <Text>{t('screens.settings.app')}</Text>
      <ListItem
        title={t('screens.settings.customize')}
        subtitle={t('screens.settings.customizeSubtitle')}
        iosIconName="slider.horizontal.3"
        androidIconName="tune"
        iconColor={colors.primary}
        onPress={() => router.push(Routes.customizeAssistant)}
      />
      <ListItem
        title={t('screens.settings.language')}
        subtitle={t('screens.settings.languageSubtitle')}
        iosIconName="character.bubble"
        androidIconName="translate"
        iconColor={colors.primary}
        onPress={() => router.push(Routes.language)}
      />
      <ListItem
        title={t('screens.settings.feedback')}
        subtitle={t('screens.settings.feedbackSubtitle')}
        iosIconName="envelope"
        androidIconName="mail"
        iconColor={colors.primary}
        onPress={sendFeedback}
      />
      <ListItem
        title={t('screens.settings.rateApp')}
        subtitle={t('screens.settings.rateAppSubtitle')}
        iosIconName="star"
        androidIconName="star"
        iconColor={colors.primary}
        onPress={() => openExternalUrl(RATE_APP_URL)}
      />
      <Text style={styles.sectionHeader}>{t('screens.settings.about')}</Text>
      <ListItem
        title={t('screens.settings.links')}
        subtitle={t('screens.settings.linksSubtitle')}
        iosIconName="link"
        androidIconName="link"
        iconColor={colors.secondary}
        onPress={() => setLinksVisible(true)}
      />
      <ListItem
        title={t('screens.settings.terms')}
        subtitle={t('screens.settings.termsSubtitle')}
        iosIconName="doc.text.fill"
        androidIconName="description"
        iconColor={colors.secondary}
        onPress={() => router.push(Routes.terms)}
      />
      <ListItem
        title={t('screens.settings.privacyPolicy')}
        subtitle={t('screens.settings.privacyPolicySubtitle')}
        iosIconName="lock.shield.fill"
        androidIconName="privacy_tip"
        iconColor={colors.secondary}
        onPress={() => router.push(Routes.privacyPolicy)}
      />
      <ListItem
        title={t('screens.settings.acknowledgements')}
        subtitle={t('screens.settings.acknowledgementsSubtitle')}
        iosIconName={ACKNOWLEDGEMENTS_IOS_ICON}
        androidIconName="license"
        iconColor={colors.secondary}
        onPress={() => router.push(Routes.acknowledgements)}
      />
      <Text variant="h3" bold style={styles.appName}>
        NobodyWho Chat
      </Text>
      <Text variant="body2" style={styles.appInfo}>
        {appInfo}
      </Text>
      <LinksSheet
        visible={linksVisible}
        onClose={() => setLinksVisible(false)}
      />
    </HeaderScrollView>
  );
};
