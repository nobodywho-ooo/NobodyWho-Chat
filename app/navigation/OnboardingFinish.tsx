import { createContext, useContext } from 'react';

// Ends onboarding: the root layout swaps the onboarding routes for the app's.
export const OnboardingFinishContext = createContext<() => void>(
  () => undefined,
);

export const useOnboardingFinish = () => useContext(OnboardingFinishContext);
