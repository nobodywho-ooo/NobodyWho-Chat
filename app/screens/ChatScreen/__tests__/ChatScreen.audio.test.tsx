import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

import { buildModel } from 'jest/factories/model';
import { mockTtsLoad } from 'jest/mock/node-modules';
import { setAppState } from 'database';
import { AiServiceProvider, AiSlots, useAiService } from 'services';
import { DisplayMessage, ModelPipeline } from 'types';

import { ChatScreen } from '../ChatScreen';

// A voice engine takes a second or so to load, so the history is always on
// screen before TTS is ready — and LegendList memoizes its rows on
// (key, item, extraData). Everything a row reads from outside its own message
// therefore has to travel through extraData, or the speaker button never
// reaches a message that was rendered while the engine was still loading.

const PLAY_LABEL = 'components.messageListItem.playAudio';

const ttsModel = buildModel(9, {
  pipeline: ModelPipeline.textToSpeech,
  family: 'Supertonic',
  parts: [
    {
      url: 'https://example.com/onnx/vocoder.onnx',
      fileName: 'onnx/vocoder.onnx',
      type: 'tts-file',
      path: '/models/9/onnx/vocoder.onnx',
      sizeGB: 0.1,
    },
  ],
});

const messages: DisplayMessage[] = [
  { role: 'user', content: 'Hello there', uid: 'user-1' },
  { role: 'assistant', content: 'Hi! How can I help you?', uid: 'assistant-1' },
];

let slots: AiSlots | undefined;

// The screen has no way to load a voice model itself (ChatStackNavigator owns
// that), so reach the slot through the same context the screen reads.
const SlotProbe: React.FC = () => {
  slots = useAiService().slots;
  return null;
};

beforeEach(() => {
  slots = undefined;
  mockTtsLoad.mockReset();
});

test('a message rendered before the TTS engine was ready still gets its speaker button', async () => {
  mockTtsLoad.mockResolvedValue({ synthesize: jest.fn(), destroy: jest.fn() });

  const screen = render(
    <AiServiceProvider>
      <SlotProbe />
      <ChatScreen
        conversationId={1}
        messages={messages}
        onConversationCreated={jest.fn()}
      />
    </AiServiceProvider>,
  );

  // Nothing loaded to read the message aloud with yet.
  expect(screen.queryByLabelText(PLAY_LABEL)).toBeNull();

  await act(async () => {
    await setAppState({ ttsModelIdInUse: ttsModel.id });
    await slots?.tts.create({ model: ttsModel, voice: 'M1', language: 'en' });
  });

  await waitFor(() => expect(screen.getByLabelText(PLAY_LABEL)).toBeTruthy());
});
