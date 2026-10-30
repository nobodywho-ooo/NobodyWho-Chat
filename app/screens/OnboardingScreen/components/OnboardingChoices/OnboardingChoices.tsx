import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DeviceCatalogue, onboardingChatModels } from 'helpers';
import { useCuratedModels, useStyled } from 'hooks';

import { OnboardingParamList } from '../../Onboarding.types';
import { OnboardingContext } from '../../hooks/useOnboarding';
import { Intro } from '../Intro/Intro';
import { OnboardingDownload } from '../OnboardingDownload/OnboardingDownload';
import { TextModelChoice } from '../TextModelChoice/TextModelChoice';
import { VoiceChoice } from '../VoiceChoice/VoiceChoice';
import { Welcome } from '../Welcome/Welcome';

const Stack = createNativeStackNavigator<OnboardingParamList>();

interface OnboardingChoicesProps {
  catalogue: DeviceCatalogue;
  onFinish: () => void;
}

export const OnboardingChoices: React.FC<OnboardingChoicesProps> = ({
  catalogue,
  onFinish,
}) => {
  const { colors } = useStyled();
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
      <Stack.Navigator
        screenOptions={{
          title: '',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.onSurface,
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen
          name="Intro"
          component={Intro}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Welcome"
          component={Welcome}
          options={{ headerShown: false }}
        />
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
