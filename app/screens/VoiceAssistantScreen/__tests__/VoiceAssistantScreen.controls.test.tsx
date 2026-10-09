import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { buildModel } from 'jest/factories/model';
import { mockUseSlotModel } from 'jest/mock/hooks';
import { ModelPipeline } from 'types';

import type { VoiceStatus } from '../hooks';
import { VoiceAssistantScreen } from '../VoiceAssistantScreen';

// Drive the screen through each phase of a turn directly: reaching 'thinking'
// for real would mean recording, transcribing and generating first, and all this
// suite cares about is which control each phase puts on screen.
let mockStatus: VoiceStatus = 'idle';
let mockHasAnswered = false;

jest.mock('../hooks', () => {
  const actual = jest.requireActual('../hooks');
  const level = { value: 0 };
  return {
    ...actual,
    useVoiceLevels: () => ({
      levels: { level, low: level, high: level, active: level },
      feedPcm: jest.fn(),
      listen: jest.fn(),
      speak: jest.fn(),
      rest: jest.fn(),
    }),
    useVoiceConversation: () => ({
      status: mockStatus,
      voiceAssistantStatus: {
        isChatReady: true,
        isSttReady: true,
        isTtsReady: true,
        isVadReady: true,
      },
      isBusy: false,
      hasAnswered: mockHasAnswered,
      toggle: jest.fn(),
    }),
  };
});

// The glow is on screen when its radial-gradient blobs are; nothing else on
// the screen paints a background image.
const glowBlobsOf = (screen: Awaited<ReturnType<typeof render>>) =>
  screen.container.queryAll(
    node =>
      typeof StyleSheet.flatten(node.props.style)
        ?.experimental_backgroundImage === 'string',
  );

const renderAt = async (
  status: VoiceStatus,
  onCloseDrawer = jest.fn(),
  hasAnswered = false,
) => {
  mockStatus = status;
  mockHasAnswered = hasAnswered;
  const screen = await render(
    <VoiceAssistantScreen onCloseDrawer={onCloseDrawer} />,
  );

  return {
    screen,
    onCloseDrawer,
    spinner:
      screen.container.queryAll(node => node.type === 'ActivityIndicator')[0] ??
      null,
    stopButton: screen.queryByLabelText('screens.voiceAssistant.stop'),
    startButton: screen.queryByLabelText('screens.voiceAssistant.start'),
  };
};

test.each<VoiceStatus>(['transcribing', 'thinking'])(
  'shows a spinner and no button while %s, so the work cannot be stopped',
  async status => {
    const { spinner, stopButton, startButton } = await renderAt(status);

    expect(spinner).toBeTruthy();
    expect(stopButton).toBeNull();
    expect(startButton).toBeNull();
  },
);

test('offers a stop button while the user is talking', async () => {
  const { spinner, stopButton } = await renderAt('listening');

  expect(stopButton).toBeTruthy();
  expect(spinner).toBeNull();
});

test('offers a stop button while the answer is playing back', async () => {
  const { spinner, stopButton } = await renderAt('speaking');

  expect(stopButton).toBeTruthy();
  expect(spinner).toBeNull();
});

test.each<VoiceStatus>(['idle', 'error'])(
  'offers a start button when %s',
  async status => {
    const { spinner, startButton } = await renderAt(status);

    expect(startButton).toBeTruthy();
    expect(spinner).toBeNull();
  },
);

// --- Voice preferences -----------------------------------------------------
// A Supertonic model with one known language is enough for
// TextToSpeechPreferences to render a section; it bows out entirely when the
// in-use model offers nothing.
const ttsModel = buildModel(7, {
  pipeline: ModelPipeline.textToSpeech,
  family: 'Supertonic',
  languages: ['English'],
});

beforeEach(() => {
  mockUseSlotModel.mockReturnValue(ttsModel);
  mockHasAnswered = false;
});

test.each<VoiceStatus>([
  'unavailable',
  'listening',
  'transcribing',
  'thinking',
  'synthesizing',
  'speaking',
  'error',
])('offers no preferences button while %s', async status => {
  const { screen } = await renderAt(status);

  expect(
    screen.queryByLabelText('screens.voiceAssistant.preferences'),
  ).toBeNull();
});

test('offers no preferences button once the assistant has answered', async () => {
  // Voice and language are load-time options, so an edit here would reload the
  // engine in the middle of a conversation.
  const { screen } = await renderAt('idle', jest.fn(), true);

  expect(
    screen.queryByLabelText('screens.voiceAssistant.preferences'),
  ).toBeNull();
  expect(screen.getByText('screens.voiceAssistant.status.idle')).toBeTruthy();
});

test('opening the preferences replaces the voice body', async () => {
  const { screen } = await renderAt('idle');
  expect(glowBlobsOf(screen).length).toBeGreaterThan(0);

  await fireEvent.press(
    screen.getByLabelText('screens.voiceAssistant.preferences'),
  );

  expect(
    screen.getByText('screens.customizeAssistant.textToSpeech'),
  ).toBeTruthy();
  expect(screen.queryByText('screens.voiceAssistant.status.idle')).toBeNull();
  expect(screen.queryByLabelText('screens.voiceAssistant.start')).toBeNull();
  // The glow goes too, rather than shining through the settings.
  expect(glowBlobsOf(screen)).toHaveLength(0);
  // Nothing left to configure from here, so the button goes with the panel.
  expect(
    screen.queryByLabelText('screens.voiceAssistant.preferences'),
  ).toBeNull();
});

test('the close button steps back to the voice body instead of closing the drawer', async () => {
  const { screen, onCloseDrawer } = await renderAt('idle');

  await fireEvent.press(
    screen.getByLabelText('screens.voiceAssistant.preferences'),
  );
  await fireEvent.press(screen.getByLabelText('screens.voiceAssistant.close'));

  expect(onCloseDrawer).not.toHaveBeenCalled();
  expect(screen.getByText('screens.voiceAssistant.status.idle')).toBeTruthy();
  expect(
    screen.queryByText('screens.customizeAssistant.textToSpeech'),
  ).toBeNull();

  // Back on the voice body, it closes the drawer again.
  await fireEvent.press(screen.getByLabelText('screens.voiceAssistant.close'));
  expect(onCloseDrawer).toHaveBeenCalledTimes(1);
});

test('a turn starting while the panel is open takes it down', async () => {
  const { screen } = await renderAt('idle');

  await fireEvent.press(
    screen.getByLabelText('screens.voiceAssistant.preferences'),
  );
  expect(
    screen.getByText('screens.customizeAssistant.textToSpeech'),
  ).toBeTruthy();

  mockStatus = 'listening';
  await screen.rerender(<VoiceAssistantScreen onCloseDrawer={jest.fn()} />);

  expect(
    screen.queryByText('screens.customizeAssistant.textToSpeech'),
  ).toBeNull();
  expect(
    screen.getByText('screens.voiceAssistant.status.listening'),
  ).toBeTruthy();
});

test('an answer landing while the panel is open takes it down', async () => {
  const { screen } = await renderAt('idle');

  await fireEvent.press(
    screen.getByLabelText('screens.voiceAssistant.preferences'),
  );

  mockHasAnswered = true;
  await screen.rerender(<VoiceAssistantScreen onCloseDrawer={jest.fn()} />);

  expect(
    screen.queryByText('screens.customizeAssistant.textToSpeech'),
  ).toBeNull();
  expect(screen.getByText('screens.voiceAssistant.status.idle')).toBeTruthy();
});
