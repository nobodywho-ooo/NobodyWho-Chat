import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, GradientText, PlatformIcon, Text } from 'components';
import { haptics } from 'helpers';
import { useStyled } from 'hooks';
import { Spacings, Layout } from 'style';

import { useRouter } from 'expo-router';
import { Routes } from 'navigation';

import { ONBOARDING_PADDING_HORIZONTAL } from '../../Onboarding.styles';
import styles from './Welcome.styles';

const FEATURE_ICON_SIZE = 20;

const FEATURES = [
  {
    key: 'assistant',
    iosIconName: 'sparkles',
    androidIconName: 'star_shine',
  },
  {
    key: 'private',
    iosIconName: 'lock.fill',
    androidIconName: 'lock',
  },
  {
    key: 'fast',
    iosIconName: 'bolt.fill',
    androidIconName: 'bolt',
  },
  {
    key: 'webSearch',
    iosIconName: 'globe',
    androidIconName: 'language',
  },
] as const;

export const Welcome: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useStyled();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + Spacings.lg,
          paddingLeft: insets.left + ONBOARDING_PADDING_HORIZONTAL,
          paddingRight: insets.right + ONBOARDING_PADDING_HORIZONTAL,
        },
      ]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="h1" accessibilityRole="header" style={styles.title}>
          {t('screens.onboarding.welcome.title')}
          {'\n'}
          <GradientText
            variant="h1"
            from={colors.brandGradientStart}
            to={colors.brandGradientEnd}
          >
            nobodywho
          </GradientText>{' '}
          chat
        </Text>

        <View style={styles.featuresContainer}>
          {FEATURES.map(({ key, iosIconName, androidIconName }) => (
            <View key={key} style={styles.featureContainer}>
              <PlatformIcon
                iosIconName={iosIconName}
                androidIconName={androidIconName}
                size={FEATURE_ICON_SIZE}
                color={colors.onSurface}
              />
              <View style={styles.featureTextContainer}>
                <Text variant="body1" bold>
                  {t(`screens.onboarding.welcome.${key}.title`)}
                </Text>
                <Text
                  variant="body2"
                  style={{ color: colors.onSurfaceVariant }}
                >
                  {t(`screens.onboarding.welcome.${key}.subtitle`)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <Button
        title={t('screens.onboarding.welcome.continue')}
        testID="onboarding-continue-button"
        variant="secondary"
        onPress={() => {
          haptics.medium();
          router.replace(Routes.onboardingTextModel);
        }}
        style={Layout.content}
      />
    </View>
  );
};
