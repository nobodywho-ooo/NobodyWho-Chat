import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { curatedOnboardingModels } from 'helpers';
import { isChatPipeline, Model } from 'types';

import { OnboardingScreenProps } from '../../Onboarding.types';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useOnboardingHeader } from '../../hooks/useOnboardingHeader';
import { OnboardingModelCard } from '../OnboardingModelCard/OnboardingModelCard';
import { OnboardingStep } from '../OnboardingStep/OnboardingStep';

export const TextModelChoice: React.FC<
  OnboardingScreenProps<'TextModelChoice'>
> = ({ navigation }) => {
  const { t } = useTranslation();
  const {
    chatModels,
    curatedModels: { availabilityOf },
  } = useOnboarding();

  useOnboardingHeader(navigation, false);

  const handlePress = useCallback(
    (model: Model) => {
      const voiceAvailability = availabilityOf(
        curatedOnboardingModels(model.id, 'textAndVoice'),
      );

      const offersVoice =
        voiceAvailability.kind === 'automatic' &&
        voiceAvailability.models.some(
          ({ pipeline }) => !isChatPipeline(pipeline),
        );

      if (offersVoice) {
        navigation.navigate('VoiceChoice', { modelId: model.id });
        return;
      }

      navigation.navigate('OnboardingDownload', {
        modelId: model.id,
        setup: 'textOnly',
      });
    },
    [navigation, availabilityOf],
  );

  return (
    <OnboardingStep
      header={t('screens.onboarding.header')}
      title={t('screens.onboarding.title')}
      subtitle={t('screens.onboarding.subtitle')}
    >
      {chatModels.map(model => (
        <OnboardingModelCard
          key={model.id}
          model={model}
          onPress={handlePress}
        />
      ))}
    </OnboardingStep>
  );
};
