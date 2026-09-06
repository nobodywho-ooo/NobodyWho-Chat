import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { VoiceActivityDetectionEvent } from 'react-native-nobodywho';

import { buildModel } from 'jest/factories/model';
import { ModelPipeline } from 'types';
import { AiServiceProvider, useAiService } from 'services';

import { useSpeechService } from '../useSpeechService';

(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;

const vadModel = buildModel(12, {
  pipeline: ModelPipeline.voiceActivityDetection,
  family: 'Silero',
  parts: [
    {
      url: 'https://example.com/model.onnx',
      fileName: 'model.onnx',
      type: 'vad-file',
      path: '/models/12/model.onnx',
      sizeGB: 0.002,
    },
  ],
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AiServiceProvider>{children}</AiServiceProvider>
);

// The speech service reads the detection model off the shared AiService, so
// each test drives the real provider and loads the (mocked) model via createVad.
const renderSpeechService = () =>
  renderHook(() => ({ speech: useSpeechService(), service: useAiService() }), {
    wrapper,
  });

// The instance the provider is holding, with the mocked push/finish on it.
type MockVad = {
  mockEvents: number[];
  push: jest.Mock;
  finish: jest.Mock;
  destroy: jest.Mock;
};

test('is disabled, and inert, with no detection model loaded', () => {
  const { result } = renderSpeechService();

  expect(result.current.speech.enabled).toBe(false);
  expect(result.current.speech.push(Int16Array.from([1, 2, 3]), 16000)).toBe(
    false,
  );
  expect(result.current.speech.takeSpeechToTranscribe()).toBeUndefined();
});

test('reports the end of speech and hands back the captured segment', async () => {
  const { result } = renderSpeechService();

  await act(async () => {
    await result.current.service.createVad({ model: vadModel });
  });
  expect(result.current.speech.enabled).toBe(true);

  const vad = result.current.service.vad.current as unknown as MockVad;
  vad.mockEvents = [
    VoiceActivityDetectionEvent.SpeechStarted,
    VoiceActivityDetectionEvent.Speech,
    VoiceActivityDetectionEvent.SpeechEnded,
  ];

  const chunk = Int16Array.from([1, 2, 3, 4]);
  expect(result.current.speech.push(chunk, 16000)).toBe(false);
  expect(result.current.speech.push(chunk, 16000)).toBe(false);
  expect(result.current.speech.push(chunk, 16000)).toBe(true);

  vad.finish.mockReturnValueOnce([5, 6, 7]);
  const speech = result.current.speech.takeSpeechToTranscribe();
  expect(speech).toBeInstanceOf(Int16Array);
  expect(Array.from(speech!)).toEqual([5, 6, 7]);
});

test('resamples the recording to the rate the detection model was loaded with', async () => {
  const { result } = renderSpeechService();

  await act(async () => {
    await result.current.service.createVad({ model: vadModel });
  });

  const vad = result.current.service.vad.current as unknown as MockVad;
  // 48 kHz hardware: six samples become two at the model's 16 kHz.
  result.current.speech.push(Int16Array.from([0, 3, 6, 10, 20, 30]), 48000);

  const pushed = vad.push.mock.calls[0][0] as Int16Array;
  expect(Array.from(pushed)).toEqual([3, 20]);
});

test('treats an empty finish as no speech, so the caller keeps its own recording', async () => {
  const { result } = renderSpeechService();

  await act(async () => {
    await result.current.service.createVad({ model: vadModel });
  });

  const vad = result.current.service.vad.current as unknown as MockVad;
  vad.finish.mockReturnValueOnce([]);

  expect(result.current.speech.takeSpeechToTranscribe()).toBeUndefined();
});

test('degrades to manual stop for the rest of the turn once push throws', async () => {
  const { result } = renderSpeechService();

  await act(async () => {
    await result.current.service.createVad({ model: vadModel });
  });

  const vad = result.current.service.vad.current as unknown as MockVad;
  vad.push.mockImplementationOnce(() => {
    throw new Error('native failure');
  });

  const chunk = Int16Array.from([1, 2, 3]);
  expect(result.current.speech.push(chunk, 16000)).toBe(false);
  // Neither the next window nor the drain reaches the detector again…
  expect(result.current.speech.push(chunk, 16000)).toBe(false);
  expect(vad.push).toHaveBeenCalledTimes(1);
  expect(result.current.speech.takeSpeechToTranscribe()).toBeUndefined();

  // …until the next recording starts.
  act(() => result.current.speech.reset());
  expect(result.current.speech.push(chunk, 16000)).toBe(false);
  expect(vad.push).toHaveBeenCalledTimes(2);
});

test('reset clears the model so an abandoned turn cannot bleed into the next', async () => {
  const { result } = renderSpeechService();

  await act(async () => {
    await result.current.service.createVad({ model: vadModel });
  });

  const vad = result.current.service.vad.current as unknown as MockVad;
  act(() => result.current.speech.reset());

  expect(vad.finish).toHaveBeenCalledTimes(1);
});
