import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { VoiceSetup } from '../components/VoiceSetup';
import type { VoiceModelDownloads, VoiceSetupState } from '../hooks';

const mockDownloads: VoiceModelDownloads = {
  state: 'ready',
  progress: 0,
  download: jest.fn(),
  resume: jest.fn(),
  cancel: jest.fn(),
};

jest.mock('../hooks', () => ({
  useVoiceModelDownloads: () => mockDownloads,
}));

const status = {
  isChatReady: false,
  isSttReady: false,
  isTtsReady: false,
  isVadReady: false,
  isLoading: false,
};

const renderAt = async (state: VoiceSetupState, onOpenModels = jest.fn()) => {
  mockDownloads.state = state;
  await render(<VoiceSetup status={status} onOpenModels={onOpenModels} />);
  return onOpenModels;
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('downloads the missing models in one tap when it can', async () => {
  await renderAt('automatic');

  await fireEvent.press(screen.getByTestId('voice-download-button'));

  expect(mockDownloads.download).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('voice-browse-models-button')).toBeNull();
});

test('opens the Models screen, and nothing more, when it cannot', async () => {
  const onOpenModels = await renderAt('manual');

  await fireEvent.press(screen.getByTestId('voice-browse-models-button'));

  expect(onOpenModels).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('voice-download-button')).toBeNull();
  screen.getByText('screens.voiceAssistant.setup.description');
});

test('keeps the download button disabled until it knows', async () => {
  await renderAt('loading');

  expect(screen.getByTestId('voice-download-button').props.disabled).toBe(true);
});

test('offers no action once the models are there', async () => {
  await renderAt('ready');

  expect(screen.queryByTestId('voice-download-button')).toBeNull();
  expect(screen.queryByTestId('voice-browse-models-button')).toBeNull();
});
