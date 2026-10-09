import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { AudioSpeakerButton } from '../AssistantMessage/AudioSpeakerButton';

// The i18n `t` returns the key verbatim in tests, so labels are asserted by
// their translation key; PlatformIcon is globally stubbed to a host element.

test('shows a play control when idle and speaks the message on press', async () => {
  const onPlay = jest.fn();
  const onStop = jest.fn();
  const { getByLabelText } = await render(
    <AudioSpeakerButton
      isLoading={false}
      isPlaying={false}
      messageId="row:2"
      content="Hello world"
      onPlay={onPlay}
      onStop={onStop}
    />,
  );

  await fireEvent.press(getByLabelText('components.messageListItem.playAudio'));

  expect(onPlay).toHaveBeenCalledWith('row:2', 'Hello world');
  expect(onStop).not.toHaveBeenCalled();
});

test('strips thinking blocks from the spoken text', async () => {
  const onPlay = jest.fn();
  const { getByLabelText } = await render(
    <AudioSpeakerButton
      isLoading={false}
      isPlaying={false}
      messageId="row:0"
      content="<think>weighing it</think>The answer is 42"
      onPlay={onPlay}
    />,
  );

  await fireEvent.press(getByLabelText('components.messageListItem.playAudio'));

  expect(onPlay).toHaveBeenCalledWith('row:0', 'The answer is 42');
});

test('shows a stop control while playing and stops on press', async () => {
  const onPlay = jest.fn();
  const onStop = jest.fn();
  const { getByLabelText, queryByLabelText } = await render(
    <AudioSpeakerButton
      isLoading={false}
      isPlaying
      messageId="row:1"
      content="Hello world"
      onPlay={onPlay}
      onStop={onStop}
    />,
  );

  // While playing there is no play affordance, only stop.
  expect(queryByLabelText('components.messageListItem.playAudio')).toBeNull();

  await fireEvent.press(getByLabelText('components.messageListItem.stopAudio'));

  expect(onStop).toHaveBeenCalledTimes(1);
  expect(onPlay).not.toHaveBeenCalled();
});

test('shows a spinner instead of a button while synthesizing', async () => {
  const onPlay = jest.fn();
  const onStop = jest.fn();
  const screen = await render(
    <AudioSpeakerButton
      isLoading
      isPlaying={false}
      messageId="row:0"
      content="Hello world"
      onPlay={onPlay}
      onStop={onStop}
    />,
  );

  expect(
    screen.container.queryAll(node => node.type === 'ActivityIndicator'),
  ).toHaveLength(1);
  expect(
    screen.queryByLabelText('components.messageListItem.playAudio'),
  ).toBeNull();
  expect(
    screen.queryByLabelText('components.messageListItem.stopAudio'),
  ).toBeNull();
});

test('does not throw when pressed without handlers', async () => {
  const { getByLabelText } = await render(
    <AudioSpeakerButton
      isLoading={false}
      isPlaying={false}
      messageId="row:0"
      content="Hello world"
    />,
  );

  // onPlay/onStop are optional — an undefined handler must be a no-op, not a crash.
  await expect(
    fireEvent.press(getByLabelText('components.messageListItem.playAudio')),
  ).resolves.not.toThrow();
});

test('matches the snapshot', async () => {
  const { toJSON } = await render(
    <AudioSpeakerButton
      isLoading={false}
      isPlaying={false}
      messageId="row:0"
      content="Hello world"
      onPlay={jest.fn()}
      onStop={jest.fn()}
    />,
  );
  expect(toJSON()).toMatchSnapshot();
});
