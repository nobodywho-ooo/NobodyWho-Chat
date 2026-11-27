import React from 'react';
import { useTranslation } from 'react-i18next';
import { Stack } from 'expo-router';
import { useMenuHeaderOptions, usePushedScreenOptions } from 'navigation';

export default function SettingsLayout() {
  const { t } = useTranslation();
  const menuOptions = useMenuHeaderOptions(t('navigation.settings'));
  const pushedOptions = usePushedScreenOptions();

  return (
    <Stack screenOptions={pushedOptions}>
      <Stack.Screen name="index" options={menuOptions} />
      <Stack.Screen
        name="customize-assistant"
        options={{ title: t('navigation.customizeAssistant') }}
      />
      <Stack.Screen
        name="language"
        options={{ title: t('navigation.language') }}
      />
      <Stack.Screen name="terms" options={{ title: t('navigation.terms') }} />
      <Stack.Screen
        name="privacy-policy"
        options={{ title: t('navigation.privacyPolicy') }}
      />
      <Stack.Screen
        name="acknowledgements"
        options={{ title: t('navigation.acknowledgements') }}
      />
    </Stack>
  );
}
