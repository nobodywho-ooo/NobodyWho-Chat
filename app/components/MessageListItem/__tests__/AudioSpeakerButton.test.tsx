import React from 'react';
import { ActivityIndicator } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { AudioSpeakerButton } from '../AssistantMessage/AudioSpeakerButton';

// The i18n `t` returns the key verbatim in tests, so labels are asserted by
// their translation key; PlatformIcon is globally stubbed to a host element.

test('shows a play control when idle and speaks the message on press', () => {
  const onPlay = jest.fn();
  const onStop = jest.fn();
  const { getByLabelText } = render(
    <AudioSpeakerButton
      isLoading={false}
      isPlaying={false}
      index={2}
      content="Hello world"
      onPlay={onPlay}
      onStop={onStop}
    />,
  );

  fireEvent.press(getByLabelText('components.messageListItem.playAudio'));

  expect(onPlay).toHaveBeenCalledWith(2, 'Hello world');
  expect(onStop).not.toHaveBeenCalled();
});

test('strips thinking blocks from the spoken text', () => {
  const onPlay = jest.fn();
  const { getByLabelText } = render(
    <AudioSpeakerButton
      isLoading={false}
      isPlaying={false}
      index={0}
      content="<think>weighing it</think>The answer is 42"
      onPlay={onPlay}
    />,
  );

  fireEvent.press(getByLabelText('components.messageListItem.playAudio'));

  expect(onPlay).toHaveBeenCalledWith(0, 'The answer is 42');
});

test('shows a stop control while playing and stops on press', () => {
  const onPlay = jest.fn();
  const onStop = jest.fn();
  const { getByLabelText, queryByLabelText } = render(
    <AudioSpeakerButton
      isLoading={false}
      isPlaying
      index={1}
      content="Hello world"
      onPlay={onPlay}
      onStop={onStop}
    />,
  );

  // While playing there is no play affordance, only stop.
  expect(queryByLabelText('components.messageListItem.playAudio')).toBeNull();

  fireEvent.press(getByLabelText('components.messageListItem.stopAudio'));

  expect(onStop).toHaveBeenCalledTimes(1);
  expect(onPlay).not.toHaveBeenCalled();
});

test('shows a spinner instead of a button while synthesizing', () => {
  const onPlay = jest.fn();
  const onStop = jest.fn();
  const screen = render(
    <AudioSpeakerButton
      isLoading
      isPlaying={false}
      index={0}
      content="Hello world"
      onPlay={onPlay}
      onStop={onStop}
    />,
  );

  expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeTruthy();
  expect(
    screen.queryByLabelText('components.messageListItem.playAudio'),
  ).toBeNull();
  expect(
    screen.queryByLabelText('components.messageListItem.stopAudio'),
  ).toBeNull();
});

test('does not throw when pressed without handlers', () => {
  const { getByLabelText } = render(
    <AudioSpeakerButton
      isLoading={false}
      isPlaying={false}
      index={0}
      content="Hello world"
    />,
  );

  // onPlay/onStop are optional — an undefined handler must be a no-op, not a crash.
  expect(() =>
    fireEvent.press(getByLabelText('components.messageListItem.playAudio')),
  ).not.toThrow();
});

test('matches the snapshot', () => {
  const { toJSON } = render(
    <AudioSpeakerButton
      isLoading={false}
      isPlaying={false}
      index={0}
      content="Hello world"
      onPlay={jest.fn()}
      onStop={jest.fn()}
    />,
  );
  expect(toJSON()).toMatchSnapshot();
});
