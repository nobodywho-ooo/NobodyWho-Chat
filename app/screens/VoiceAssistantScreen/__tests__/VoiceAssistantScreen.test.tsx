import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { IconButton } from 'components';
import { AiServiceProvider } from 'services';

import { VoiceAssistantScreen } from '../VoiceAssistantScreen';

const renderScreen = (onCloseDrawer = jest.fn()) =>
  render(
    <AiServiceProvider>
      <VoiceAssistantScreen onCloseDrawer={onCloseDrawer} />
    </AiServiceProvider>,
  );

test('renders the voice assistant title', () => {
  const screen = renderScreen();

  expect(screen.getByText('screens.voiceAssistant.title')).toBeTruthy();
});

test('prompts to set up voice models when none are loaded', () => {
  const screen = renderScreen();

  // With no chat/STT/TTS model loaded the screen shows the setup checklist.
  expect(
    screen.getByText('screens.voiceAssistant.setup.title'),
  ).toBeTruthy();
});

test('pressing the close button closes the drawer', () => {
  const onCloseDrawer = jest.fn();
  const screen = renderScreen(onCloseDrawer);

  fireEvent.press(screen.UNSAFE_getByType(IconButton));

  expect(onCloseDrawer).toHaveBeenCalled();
});
