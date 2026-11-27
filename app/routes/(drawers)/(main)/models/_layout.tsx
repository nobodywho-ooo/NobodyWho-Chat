import React from 'react';
import { useTranslation } from 'react-i18next';
import { Stack } from 'expo-router';
import { useMenuHeaderOptions } from 'navigation';

export default function ModelsLayout() {
  const { t } = useTranslation();
  const options = useMenuHeaderOptions(t('navigation.models'));

  return (
    <Stack>
      <Stack.Screen name="index" options={options} />
    </Stack>
  );
}
