import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { curatedOnboardingModels } from 'helpers';
import { isChatPipeline, Model } from 'types';

import { useRouter } from 'expo-router';
import { Routes } from 'navigation';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useOnboardingHeader } from '../../hooks/useOnboardingHeader';
import { OnboardingModelCard } from '../OnboardingModelCard/OnboardingModelCard';
import { OnboardingStep } from '../OnboardingStep/OnboardingStep';

export const TextModelChoice: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const {
    chatModels,
    curatedModels: { availabilityOf },
  } = useOnboarding();

  useOnboardingHeader(false);

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
        router.push({
          pathname: Routes.onboardingVoice,
          params: { modelId: String(model.id) },
        });
        return;
      }

      router.push({
        pathname: Routes.onboardingDownload,
        params: { modelId: String(model.id), setup: 'textOnly' },
      });
    },
    [router, availabilityOf],
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
