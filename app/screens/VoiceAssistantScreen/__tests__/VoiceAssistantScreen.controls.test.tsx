import React from 'react';
import { ActivityIndicator } from 'react-native';
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
    useOrbLevels: () => ({
      levels: { level, low: level, mid: level, high: level },
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

const renderAt = (
  status: VoiceStatus,
  onCloseDrawer = jest.fn(),
  hasAnswered = false,
) => {
  mockStatus = status;
  mockHasAnswered = hasAnswered;
  const screen = render(<VoiceAssistantScreen onCloseDrawer={onCloseDrawer} />);

  return {
    screen,
    onCloseDrawer,
    spinner: screen.UNSAFE_queryByType(ActivityIndicator),
    stopButton: screen.queryByLabelText('screens.voiceAssistant.stop'),
    startButton: screen.queryByLabelText('screens.voiceAssistant.start'),
  };
};

test.each<VoiceStatus>(['transcribing', 'thinking'])(
  'shows a spinner and no button while %s, so the work cannot be stopped',
  status => {
    const { spinner, stopButton, startButton } = renderAt(status);

    expect(spinner).toBeTruthy();
    expect(stopButton).toBeNull();
    expect(startButton).toBeNull();
  },
);

test('offers a stop button while the user is talking', () => {
  const { spinner, stopButton } = renderAt('listening');

  expect(stopButton).toBeTruthy();
  expect(spinner).toBeNull();
});

test('offers a stop button while the answer is playing back', () => {
  const { spinner, stopButton } = renderAt('speaking');

  expect(stopButton).toBeTruthy();
  expect(spinner).toBeNull();
});

test.each<VoiceStatus>(['idle', 'error'])(
  'offers a start button when %s',
  status => {
    const { spinner, startButton } = renderAt(status);

    expect(startButton).toBeTruthy();
    expect(spinner).toBeNull();
  },
);

// --- Voice preferences -----------------------------------------------------
// A Supertonic model with one known language is enough for VoicePreferences to
// render a section; it bows out entirely when the in-use model offers nothing.
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
])('offers no preferences button while %s', status => {
  const { screen } = renderAt(status);

  expect(
    screen.queryByLabelText('screens.voiceAssistant.preferences'),
  ).toBeNull();
});

test('offers no preferences button once the assistant has answered', () => {
  // Voice and language are load-time options, so an edit here would reload the
  // engine in the middle of a conversation.
  const { screen } = renderAt('idle', jest.fn(), true);

  expect(
    screen.queryByLabelText('screens.voiceAssistant.preferences'),
  ).toBeNull();
  expect(screen.getByText('screens.voiceAssistant.status.idle')).toBeTruthy();
});

test('opening the preferences replaces the orb body', () => {
  const { screen } = renderAt('idle');

  fireEvent.press(screen.getByLabelText('screens.voiceAssistant.preferences'));

  expect(screen.getByText('screens.customizeAssistant.language')).toBeTruthy();
  expect(screen.queryByText('screens.voiceAssistant.status.idle')).toBeNull();
  expect(screen.queryByLabelText('screens.voiceAssistant.start')).toBeNull();
  // Nothing left to configure from here, so the button goes with the panel.
  expect(
    screen.queryByLabelText('screens.voiceAssistant.preferences'),
  ).toBeNull();
});

test('the close button steps back to the orb instead of closing the drawer', () => {
  const { screen, onCloseDrawer } = renderAt('idle');

  fireEvent.press(screen.getByLabelText('screens.voiceAssistant.preferences'));
  fireEvent.press(screen.getByLabelText('screens.voiceAssistant.close'));

  expect(onCloseDrawer).not.toHaveBeenCalled();
  expect(screen.getByText('screens.voiceAssistant.status.idle')).toBeTruthy();
  expect(screen.queryByText('screens.customizeAssistant.language')).toBeNull();

  // Back on the orb, it closes the drawer again.
  fireEvent.press(screen.getByLabelText('screens.voiceAssistant.close'));
  expect(onCloseDrawer).toHaveBeenCalledTimes(1);
});

test('a turn starting while the panel is open takes it down', () => {
  const { screen } = renderAt('idle');

  fireEvent.press(screen.getByLabelText('screens.voiceAssistant.preferences'));
  expect(screen.getByText('screens.customizeAssistant.language')).toBeTruthy();

  mockStatus = 'listening';
  screen.update(<VoiceAssistantScreen onCloseDrawer={jest.fn()} />);

  expect(screen.queryByText('screens.customizeAssistant.language')).toBeNull();
  expect(
    screen.getByText('screens.voiceAssistant.status.listening'),
  ).toBeTruthy();
});

test('an answer landing while the panel is open takes it down', () => {
  const { screen } = renderAt('idle');

  fireEvent.press(screen.getByLabelText('screens.voiceAssistant.preferences'));

  mockHasAnswered = true;
  screen.update(<VoiceAssistantScreen onCloseDrawer={jest.fn()} />);

  expect(screen.queryByText('screens.customizeAssistant.language')).toBeNull();
  expect(screen.getByText('screens.voiceAssistant.status.idle')).toBeTruthy();
});
