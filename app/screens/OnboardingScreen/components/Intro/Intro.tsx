import React, { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'components';
import { haptics } from 'helpers';
import { useStyled } from 'hooks';
import { Spacings, Layout } from 'style';

import { OnboardingScreenProps } from '../../Onboarding.types';
import { FIRST_CENTERED_NAME, ModelOrbit } from '../ModelOrbit/ModelOrbit';
import { ModelName } from './ModelName';

import styles from './Intro.styles';

export const Intro: React.FC<OnboardingScreenProps<'Intro'>> = ({
  navigation,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const insets = useSafeAreaInsets();

  const [modelName, setModelName] = useState(FIRST_CENTERED_NAME);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <ModelOrbit onCenterChange={setModelName} />

      {/* Touches pass through to the wheel everywhere but the button. */}
      <View
        pointerEvents="box-none"
        style={[
          styles.contentContainer,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom + Spacings.lg,
          },
        ]}
      >
        <View pointerEvents="none" style={styles.heroContainer}>
          <Text
            variant="h2"
            bold
            accessibilityRole="header"
            style={styles.title}
          >
            {t('screens.onboarding.intro.title')}
          </Text>
          <ModelName name={modelName} />
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
