import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchModelCatalogue, log } from 'helpers';
import { isChatPipeline, Model } from 'types';

import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { OnboardingChoices } from './components';

interface OnboardingScreenProps {
  onFinish: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onFinish,
}) => {
  const { t } = useTranslation();
  const [catalogue, setCatalogue] = useState<Model[]>();

  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    let isMounted = true;

    const loadCatalogue = async () => {
      try {
        const models = await fetchModelCatalogue();
        if (!isMounted) {
          return;
        }

        if (!models.some(model => isChatPipeline(model.pipeline))) {
          // No text model fits this device: nothing to pick from.
          onFinishRef.current();
          return;
        }

        setCatalogue(models);
      } catch (error) {
        log('OnboardingScreen fetchModelCatalogue', error);
        if (isMounted) {
          onFinishRef.current();
        }
      }
    };

    loadCatalogue();

    return () => {
      isMounted = false;
    };
  }, []);

  if (catalogue === undefined) {
    return <LoadingScreen message={t('screens.onboarding.loadingModels')} />;
  }

  return <OnboardingChoices catalogue={catalogue} onFinish={onFinish} />;
};
