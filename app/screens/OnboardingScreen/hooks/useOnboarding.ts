import { createContext, useContext } from 'react';
import { Model } from 'types';

interface OnboardingContextValue {
  catalogue: Model[];
  onFinish: () => void;
}

export const OnboardingContext = createContext<OnboardingContextValue>({
  catalogue: [],
  onFinish: () => undefined,
});

export const useOnboarding = () => useContext(OnboardingContext);
