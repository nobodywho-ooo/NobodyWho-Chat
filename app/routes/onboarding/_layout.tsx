import React from 'react';
import { Stack } from 'expo-router';
import { useStyled } from 'hooks';
import { useOnboardingFinish } from 'navigation';
import { OnboardingScreen } from 'screens';

export default function OnboardingLayout() {
  const { colors } = useStyled();
  const onFinish = useOnboardingFinish();

  return (
    <OnboardingScreen onFinish={onFinish}>
      <Stack
        screenOptions={{
          title: '',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.onSurface,
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="text-model" />
        <Stack.Screen name="voice" />
        <Stack.Screen name="download" options={{ headerShown: false }} />
      </Stack>
    </OnboardingScreen>
  );
}
