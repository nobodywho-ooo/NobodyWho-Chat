import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStyled } from 'hooks';
import { Model } from 'types';

import { OnboardingParamList } from '../../Onboarding.types';
import { OnboardingContext } from '../../hooks/useOnboarding';
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

  const value = useMemo(() => ({ catalogue, onFinish }), [catalogue, onFinish]);

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
      </Stack.Navigator>
    </OnboardingContext.Provider>
  );
};
