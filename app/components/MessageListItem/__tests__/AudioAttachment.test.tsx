import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { AudioAttachment } from '../UserMessage/AudioAttachment';

// expo-audio is mocked (jest/mock/node-modules) with a stateful player whose
// play()/pause() flip the status the component reads, so the button label
// toggles on press.
test('toggles between play and pause when pressed', () => {
  const { getByLabelText } = render(<AudioAttachment path="clip.mp3" />);

  // Starts paused → offers "play".
  const playButton = getByLabelText('components.messageListItem.playAudio');
  expect(playButton).toBeTruthy();

  fireEvent.press(playButton);

  // Now playing → offers "pause".
  expect(getByLabelText('components.messageListItem.pauseAudio')).toBeTruthy();

  fireEvent.press(getByLabelText('components.messageListItem.pauseAudio'));

  // Back to paused.
  expect(getByLabelText('components.messageListItem.playAudio')).toBeTruthy();
});

test('matches the snapshot', () => {
  const { toJSON } = render(<AudioAttachment path="clip.mp3" />);
  expect(toJSON()).toMatchSnapshot();
});
