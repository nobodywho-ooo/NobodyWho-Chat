import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { IconButton } from 'components';

import { VoiceAssistantScreen } from '../VoiceAssistantScreen';

test('renders the voice assistant title', () => {
  const screen = render(<VoiceAssistantScreen onCloseDrawer={jest.fn()} />);

  expect(screen.getByText('screens.voiceAssistant.title')).toBeTruthy();
});

test('pressing the close button closes the drawer', () => {
  const onCloseDrawer = jest.fn();
  const screen = render(
    <VoiceAssistantScreen onCloseDrawer={onCloseDrawer} />,
  );

  fireEvent.press(screen.UNSAFE_getByType(IconButton));

  expect(onCloseDrawer).toHaveBeenCalled();
});
