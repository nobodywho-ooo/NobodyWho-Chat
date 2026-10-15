import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PlatformIcon } from 'components';
import {
  curatedOnboardingModels,
  ModelSetup,
  modelDownloadSizeGB,
} from 'helpers';
import { useStyled } from 'hooks';

import { OnboardingScreenProps } from '../../Onboarding.types';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useOnboardingHeader } from '../../hooks/useOnboardingHeader';
import { OnboardingCard } from '../OnboardingCard/OnboardingCard';
import { OnboardingStep } from '../OnboardingStep/OnboardingStep';

import styles from './VoiceChoice.styles';

const CHOICE_ICON_SIZE = 24;

export const VoiceChoice: React.FC<OnboardingScreenProps<'VoiceChoice'>> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const {
    curatedModels: { findModelsToDownload },
  } = useOnboarding();
  const { modelId } = route.params;

  useOnboardingHeader(navigation, false);

  const downloadSizeGB = useCallback(
    (setup: ModelSetup) =>
      findModelsToDownload(curatedOnboardingModels(modelId, setup)).reduce(
        (sum, model) => sum + modelDownloadSizeGB(model),
        0,
      ),
    [findModelsToDownload, modelId],
  );

  const download = useCallback(
    (setup: ModelSetup) =>
      navigation.navigate('OnboardingDownload', { modelId, setup }),
    [navigation, modelId],
  );

  return (
    <OnboardingStep
      header={t('screens.onboarding.voiceHeader')}
      title={t('screens.onboarding.modalityTitle')}
      subtitle={t('screens.onboarding.modalitySubtitle')}
    >
      <OnboardingCard
        icon={
          <View style={styles.choiceIcon}>
            <PlatformIcon
              iosIconName="text.bubble"
              androidIconName="chat"
              size={CHOICE_ICON_SIZE}
              color={colors.primary}
            />
          </View>
        }
        title={t('screens.onboarding.textOnly')}
        sizeGB={downloadSizeGB('textOnly')}
        small
        testID="onboarding-text-only-button"
        onPress={() => download('textOnly')}
      />
      <OnboardingCard
        icon={
          <View style={styles.choiceIcon}>
            <PlatformIcon
              iosIconName="waveform"
              androidIconName="graphic_eq"
              size={CHOICE_ICON_SIZE}
              color={colors.primary}
            />
          </View>
        }
        title={t('screens.onboarding.textAndVoice')}
        sizeGB={downloadSizeGB('textAndVoice')}
        small
        testID="onboarding-text-voice-button"
        onPress={() => download('textAndVoice')}
      />
    </OnboardingStep>
  );
};
