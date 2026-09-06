import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

import { buildModel } from 'jest/factories/model';
import { IconButton } from 'components';
import { ModelPipeline } from 'types';
import { AiServiceProvider, useAiService } from 'services';

import { VoiceAssistantScreen } from '../VoiceAssistantScreen';

const chatModel = buildModel(1, {
  parts: [
    {
      url: 'https://example.com/model.gguf',
      fileName: 'model.gguf',
      type: 'chat-model',
      path: '/models/1/model.gguf',
      sizeGB: 1,
    },
  ],
});

const ttsModel = buildModel(7, {
  pipeline: ModelPipeline.textToSpeech,
  family: 'Supertonic',
});

const sttModel = buildModel(11, {
  pipeline: ModelPipeline.speechToText,
  family: 'Whisper',
});

const vadModel = buildModel(12, {
  pipeline: ModelPipeline.voiceActivityDetection,
  family: 'Silero',
});

// Reaches the shared AiService from inside the provider, so a test can load
// models into it exactly as the app's navigator does.
let service: ReturnType<typeof useAiService>;

const CaptureService = () => {
  service = useAiService();
  return null;
};

const renderScreen = (onCloseDrawer = jest.fn()) =>
  render(
    <AiServiceProvider>
      <CaptureService />
      <VoiceAssistantScreen onCloseDrawer={onCloseDrawer} />
    </AiServiceProvider>,
  );

test('renders the voice assistant title', () => {
  const screen = renderScreen();

  expect(screen.getByText('screens.voiceAssistant.title')).toBeTruthy();
});

test('prompts to set up voice models when none are loaded', () => {
  const screen = renderScreen();

  // With nothing loaded the screen shows the setup checklist…
  expect(screen.getByText('screens.voiceAssistant.setup.title')).toBeTruthy();
  // …listing every model hands-free chat needs, detection included.
  expect(screen.getByText('screens.voiceAssistant.setup.chat')).toBeTruthy();
  expect(screen.getByText('screens.voiceAssistant.setup.stt')).toBeTruthy();
  expect(screen.getByText('screens.voiceAssistant.setup.tts')).toBeTruthy();
  expect(screen.getByText('screens.voiceAssistant.setup.vad')).toBeTruthy();
});

test('stays unavailable until the voice detection model is loaded too', async () => {
  const screen = renderScreen();

  // Chat, transcription and speech loaded — everything except detection.
  await act(async () => {
    await service.createChat({ model: chatModel });
    await service.createStt({ model: sttModel });
    await service.createTts({ model: ttsModel });
  });

  // Nothing would notice the user had stopped talking, so the screen is not
  // usable yet and keeps asking for the missing model.
  expect(screen.getByText('screens.voiceAssistant.setup.title')).toBeTruthy();

  await act(async () => {
    await service.createVad({ model: vadModel });
  });

  expect(screen.queryByText('screens.voiceAssistant.setup.title')).toBeNull();
  expect(screen.getByText('screens.voiceAssistant.status.idle')).toBeTruthy();
});

test('pressing the close button closes the drawer', () => {
  const onCloseDrawer = jest.fn();
  const screen = renderScreen(onCloseDrawer);

  fireEvent.press(screen.UNSAFE_getByType(IconButton));

  expect(onCloseDrawer).toHaveBeenCalled();
});
