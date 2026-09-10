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

  // Starting a turn claims the shared detector for this consumer; push is inert
  // until it does.
  act(() => result.current.speech.reset());

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
  act(() => result.current.speech.reset());
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
  act(() => result.current.speech.reset());
  vad.finish.mockReturnValueOnce([]);

  expect(result.current.speech.takeSpeechToTranscribe()).toBeUndefined();
});

test('reports itself unusable once push throws, so callers stop waiting on it', async () => {
  const { result } = renderSpeechService();

  await act(async () => {
    await result.current.service.createVad({ model: vadModel });
  });

  const vad = result.current.service.vad.current as unknown as MockVad;
  act(() => result.current.speech.reset());
  vad.push.mockImplementationOnce(() => {
    throw new Error('native failure');
  });

  const chunk = Int16Array.from([1, 2, 3]);
  act(() => {
    expect(result.current.speech.push(chunk, 16000)).toBe(false);
  });

  // The detector is the voice assistant's only way to end a turn, so a failure
  // has to be visible rather than leaving it listening forever behind a
  // checklist that still claims the model is loaded.
  expect(result.current.speech.enabled).toBe(false);

  // Neither the next window nor the drain reaches the detector again, and a new
  // turn does not resurrect it — the native instance is broken until reloaded.
  expect(result.current.speech.push(chunk, 16000)).toBe(false);
  act(() => result.current.speech.reset());
  expect(result.current.speech.push(chunk, 16000)).toBe(false);
  expect(vad.push).toHaveBeenCalledTimes(1);
  expect(result.current.speech.takeSpeechToTranscribe()).toBeUndefined();
});

test('a second consumer takes the detector and preempts the first', async () => {
  const onPreempted = jest.fn();

  const { result } = renderHook(
    () => ({
      dictation: useSpeechService({ onPreempted }),
      assistant: useSpeechService(),
      service: useAiService(),
    }),
    { wrapper },
  );

  await act(async () => {
    await result.current.service.createVad({ model: vadModel });
  });

  const vad = result.current.service.vad.current as unknown as MockVad;
  act(() => result.current.dictation.reset());

  const chunk = Int16Array.from([1, 2, 3]);
  result.current.dictation.push(chunk, 16000);
  expect(vad.push).toHaveBeenCalledTimes(1);

  // The assistant starting a turn takes the shared instance over…
  act(() => result.current.assistant.reset());
  expect(onPreempted).toHaveBeenCalledTimes(1);

  // …after which the dictation's buffers no longer reach it, so its audio can't
  // interleave with the assistant's into one turn.
  expect(result.current.dictation.push(chunk, 16000)).toBe(false);
  expect(result.current.dictation.takeSpeechToTranscribe()).toBeUndefined();

  result.current.assistant.push(chunk, 16000);
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
