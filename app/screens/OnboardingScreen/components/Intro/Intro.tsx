import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'components';
import { haptics } from 'helpers';
import { useStyled } from 'hooks';
import { Spacings, Layout } from 'style';

import { OnboardingScreenProps } from '../../Onboarding.types';
import { ModelOrbit } from '../ModelOrbit/ModelOrbit';

import styles from './Intro.styles';

export const Intro: React.FC<OnboardingScreenProps<'Intro'>> = ({
  navigation,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <ModelOrbit />

      <View
        style={[
          styles.contentContainer,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom + Spacings.lg,
          },
        ]}
      >
        <View style={styles.heroContainer}>
          <Text variant="h2" accessibilityRole="header" style={styles.title}>
            <Text variant="h2" bold>
              {t('screens.onboarding.intro.title')}
            </Text>{' '}
            <Text variant="h2" style={{ color: colors.onSurfaceVariant }}>
              {t('screens.onboarding.intro.subtitle')}
            </Text>
          </Text>
        </View>

        <Button
          title={t('screens.onboarding.intro.continue')}
          testID="onboarding-intro-continue-button"
          variant="secondary"
          onPress={() => {
            haptics.medium();
            navigation.replace('Welcome');
          }}
          style={Layout.content}
        />
      </View>
    </View>
  );
};
