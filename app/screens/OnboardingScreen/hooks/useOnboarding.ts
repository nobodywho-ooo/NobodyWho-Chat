import { createContext, useContext } from 'react';
import type { CuratedModels } from 'hooks';
import { Model } from 'types';

interface OnboardingContextValue {
  chatModels: readonly Model[];
  onFinish: () => void;
  curatedModels: CuratedModels;
}

export const OnboardingContext = createContext<
  OnboardingContextValue | undefined
>(undefined);

export const useOnboarding = (): OnboardingContextValue => {
  const value = useContext(OnboardingContext);

  if (value === undefined) {
    throw new Error('useOnboarding must be used within OnboardingChoices');
  }

  return value;
};
