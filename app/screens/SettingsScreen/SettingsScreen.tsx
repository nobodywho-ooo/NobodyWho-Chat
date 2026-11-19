import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getVersion, getBuildNumber } from 'react-native-device-info';
import { openExternalUrl } from 'helpers';
import { useStyled } from 'hooks';
import { ActionButton, ListItem, Text } from 'components';

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
      <Text>{t('screens.settings.app')}</Text>
      <ListItem
        title={t('screens.settings.customize')}
        subtitle={t('screens.settings.customizeSubtitle')}
        iosIconName="slider.horizontal.3"
        androidIconName="tune"
        iconBackgroundColor={colors.primary}
        // @ts-ignore
        onPress={() => navigation.navigate('CustomizeAssistantScreen')}
      />
      <ListItem
        title={t('screens.settings.language')}
        subtitle={t('screens.settings.languageSubtitle')}
        iosIconName="character.bubble"
        androidIconName="translate"
        iconBackgroundColor={colors.primary}
        // @ts-ignore
        onPress={() => navigation.navigate('LanguageScreen')}
      />
      <Text style={styles.sectionHeader}>{t('screens.settings.about')}</Text>
      <ListItem
        title={t('screens.settings.terms')}
        subtitle={t('screens.settings.termsSubtitle')}
        iosIconName="doc.text.fill"
        androidIconName="description"
        iconBackgroundColor={colors.secondary}
        // @ts-ignore
        onPress={() => navigation.navigate('TermsScreen')}
      />
      <ListItem
        title={t('screens.settings.privacyPolicy')}
        subtitle={t('screens.settings.privacyPolicySubtitle')}
        iosIconName="lock.shield.fill"
        androidIconName="privacy_tip"
        iconBackgroundColor={colors.secondary}
        // @ts-ignore
        onPress={() => navigation.navigate('PrivacyPolicyScreen')}
      />
      <View style={styles.buttonsContainer}>
        <ActionButton
          icon={{ iosIconName: 'globe', androidIconName: 'public' }}
          label={t('screens.settings.website')}
          onPress={() => openExternalUrl('https://www.nobodywho.ai/')}
        />
        <ActionButton
          icon={{
            iosIconName: 'chevron.left.forwardslash.chevron.right',
            androidIconName: 'code',
          }}
          label={t('screens.settings.github')}
          onPress={() =>
            openExternalUrl('https://github.com/nobodywho-ooo/nobodywho')
          }
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
