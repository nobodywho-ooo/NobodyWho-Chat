import React, { useEffect, useRef, useState } from 'react';
import {
  DeviceCatalogue,
  fetchDeviceCatalogue,
  log,
  onboardingChatModels,
} from 'helpers';

import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { OnboardingChoices } from './components';

interface OnboardingScreenProps {
  onFinish: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onFinish,
}) => {
  const [catalogue, setCatalogue] = useState<DeviceCatalogue>();

  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    let isMounted = true;

    const loadCatalogue = async () => {
      try {
        const loaded = await fetchDeviceCatalogue();

        if (!isMounted) {
          return;
        }

        if (onboardingChatModels(loaded).length === 0) {
          // Nothing to set up for the user: no onboarding.
          onFinishRef.current();
          return;
        }

        setCatalogue(loaded);
      } catch (error) {
        log('OnboardingScreen fetchDeviceCatalogue', error);
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
    return <LoadingScreen />;
  }

  return <OnboardingChoices catalogue={catalogue} onFinish={onFinish} />;
};
