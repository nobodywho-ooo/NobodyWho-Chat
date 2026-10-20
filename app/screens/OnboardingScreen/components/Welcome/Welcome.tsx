import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, GradientText, PlatformIcon, Text } from 'components';
import { useStyled } from 'hooks';
import { Spacings, Layout } from 'style';

import { OnboardingScreenProps } from '../../Onboarding.types';

import styles from './Welcome.styles';

const FEATURE_ICON_SIZE = 20;

const FEATURES = [
  {
    key: 'assistant',
    iosIconName: 'sparkles',
    androidIconName: 'auto_awesome',
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
] as const;

export const Welcome: React.FC<OnboardingScreenProps<'Welcome'>> = ({
  navigation,
}) => {
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
        onPress={() => navigation.replace('TextModelChoice')}
        style={Layout.content}
      />
    </View>
  );
};
