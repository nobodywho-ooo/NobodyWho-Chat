import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useCuratedModels, useStyled } from 'hooks';
import { Model } from 'types';

import { OnboardingParamList } from '../../Onboarding.types';
import { OnboardingContext } from '../../hooks/useOnboarding';
import { OnboardingDownload } from '../OnboardingDownload/OnboardingDownload';
import { TextModelChoice } from '../TextModelChoice/TextModelChoice';
import { VoiceChoice } from '../VoiceChoice/VoiceChoice';

const Stack = createNativeStackNavigator<OnboardingParamList>();

interface OnboardingChoicesProps {
  catalogue: Model[];
  onFinish: () => void;
}

export const OnboardingChoices: React.FC<OnboardingChoicesProps> = ({
  catalogue,
  onFinish,
}) => {
  const { colors } = useStyled();
  const curatedModels = useCuratedModels(catalogue);

  const value = useMemo(
    () => ({ catalogue, onFinish, curatedModels }),
    [catalogue, onFinish, curatedModels],
  );

  return (
    <OnboardingContext.Provider value={value}>
      <Stack.Navigator
        screenOptions={{
          title: '',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.onSurface,
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="TextModelChoice" component={TextModelChoice} />
        <Stack.Screen name="VoiceChoice" component={VoiceChoice} />
        <Stack.Screen
          name="OnboardingDownload"
          component={OnboardingDownload}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </OnboardingContext.Provider>
  );
};
