import React from 'react';
import { Stack } from 'expo-router';
import { useChatHeaderOptions, usePushedScreenOptions } from 'navigation';

export default function ChatLayout() {
  const chatOptions = useChatHeaderOptions();
  const pushedOptions = usePushedScreenOptions();

  return (
    <Stack screenOptions={pushedOptions}>
      <Stack.Screen name="index" options={chatOptions} />
      <Stack.Screen name="downloaded-models" options={{ title: '' }} />
    </Stack>
  );
}
