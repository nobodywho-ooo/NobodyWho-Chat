import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { byCatalogueOrder, FIRST_PICK_TAG, RECOMMENDED_TAG } from 'helpers';
import { isChatPipeline, Model } from 'types';

import { OnboardingScreenProps } from '../../Onboarding.types';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useOnboardingHeader } from '../../hooks/useOnboardingHeader';
import { OnboardingModelCard } from '../OnboardingModelCard/OnboardingModelCard';
import { OnboardingStep } from '../OnboardingStep/OnboardingStep';

const SUGGESTED_TAGS = [RECOMMENDED_TAG, FIRST_PICK_TAG];

const suggestedChatModels = (catalogue: readonly Model[]): Model[] => {
  const chatModels = catalogue.filter(model => isChatPipeline(model.pipeline));
  const suggested = chatModels.filter(model =>
    model.tags.some(tag => SUGGESTED_TAGS.includes(tag)),
  );

  return (suggested.length > 0 ? suggested : chatModels).sort(byCatalogueOrder);
};

export const TextModelChoice: React.FC<
  OnboardingScreenProps<'TextModelChoice'>
> = ({ navigation }) => {
  const { t } = useTranslation();
  const { catalogue } = useOnboarding();

  useOnboardingHeader(navigation, false);

  const chatModels = useMemo(() => suggestedChatModels(catalogue), [catalogue]);

  const handlePress = useCallback(
    (model: Model) => navigation.navigate('VoiceChoice', { modelId: model.id }),
    [navigation],
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
