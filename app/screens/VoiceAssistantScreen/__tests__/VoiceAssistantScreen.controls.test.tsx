import React from 'react';
import { ActivityIndicator } from 'react-native';
import { render } from '@testing-library/react-native';

import type { VoiceStatus } from '../hooks';
import { VoiceAssistantScreen } from '../VoiceAssistantScreen';

// Drive the screen through each phase of a turn directly: reaching 'thinking'
// for real would mean recording, transcribing and generating first, and all this
// suite cares about is which control each phase puts on screen.
let mockStatus: VoiceStatus = 'idle';

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
      toggle: jest.fn(),
    }),
  };
});

const renderAt = (status: VoiceStatus) => {
  mockStatus = status;
  const screen = render(<VoiceAssistantScreen onCloseDrawer={jest.fn()} />);

  return {
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
