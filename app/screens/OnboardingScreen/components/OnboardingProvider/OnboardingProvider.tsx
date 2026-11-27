import React, { ReactNode, useMemo } from 'react';
import { DeviceCatalogue, onboardingChatModels } from 'helpers';
import { useCuratedModels } from 'hooks';

import { OnboardingContext } from '../../hooks/useOnboarding';

interface OnboardingProviderProps {
  catalogue: DeviceCatalogue;
  onFinish: () => void;
  children: ReactNode;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({
  catalogue,
  onFinish,
  children,
}) => {
  const curatedModels = useCuratedModels(catalogue);
  const chatModels = useMemo(
    () => onboardingChatModels(catalogue),
    [catalogue],
  );

  const value = useMemo(
    () => ({ chatModels, onFinish, curatedModels }),
    [chatModels, onFinish, curatedModels],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};
