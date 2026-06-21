import React from 'react';
import { renderHook, act } from '@testing-library/react-native';

import { buildModel } from 'jest/factories/model';
import { mockFromPath } from 'jest/mock/node-modules';
import { ModelPipeline } from 'types';

import { AiServiceProvider, useAiService, AiModelState } from '../AiService';

(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;

const model = buildModel(1, {
  parts: [
    {
      url: 'file://model.gguf',
      fileName: 'model.gguf',
      type: 'chat-model',
      path: '',
      sizeGB: 1,
    },
  ],
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AiServiceProvider>{children}</AiServiceProvider>
);

beforeEach(() => {
  mockFromPath.mockReset();
});

test('createChat loads the model and exposes the chat', async () => {
  const chat = { destroy: jest.fn() };
  mockFromPath.mockResolvedValue(chat);
  const { result } = renderHook(() => useAiService(), { wrapper });

  await act(async () => {
    await result.current.createChat({ model });
  });

  expect(mockFromPath).toHaveBeenCalledWith(
    expect.objectContaining({ modelPath: 'file://model.gguf' }),
  );
  expect(result.current.chatState).toBe(AiModelState.Ready);
  expect(result.current.chat.current).toBe(chat);
  // A plain text model reports the text-only pipeline.
  expect(result.current.chatPipeline).toBe(ModelPipeline.textGeneration);
});

test('createChat wires the projection model and reports the chat pipeline', async () => {
  const visionModel = buildModel(2, {
    pipeline: ModelPipeline.imageAudioTextToText,
    parts: [
      {
        url: 'file://model.gguf',
        fileName: 'model.gguf',
        type: 'chat-model',
        path: '',
        sizeGB: 1,
      },
      {
        url: 'file://mmproj.gguf',
        fileName: 'mmproj.gguf',
        type: 'projection-model',
        path: '',
        sizeGB: 1,
      },
    ],
  });
  const chat = { destroy: jest.fn() };
  mockFromPath.mockResolvedValue(chat);
  const { result } = renderHook(() => useAiService(), { wrapper });

  await act(async () => {
    await result.current.createChat({ model: visionModel });
  });

  expect(mockFromPath).toHaveBeenCalledWith(
    expect.objectContaining({
      modelPath: 'file://model.gguf',
      projectionModelPath: 'file://mmproj.gguf',
    }),
  );
  expect(result.current.chatPipeline).toBe(ModelPipeline.imageAudioTextToText);
});

test('disposeChat resets the chat pipeline to text-only', async () => {
  const visionModel = buildModel(2, {
    pipeline: ModelPipeline.imageTextToText,
    parts: [
      {
        url: 'file://model.gguf',
        fileName: 'model.gguf',
        type: 'chat-model',
        path: '',
        sizeGB: 1,
      },
    ],
  });
  mockFromPath.mockResolvedValue({ stopGeneration: jest.fn(), destroy: jest.fn() });
  const { result } = renderHook(() => useAiService(), { wrapper });
  await act(async () => {
    await result.current.createChat({ model: visionModel });
  });
  expect(result.current.chatPipeline).toBe(ModelPipeline.imageTextToText);

  act(() => result.current.disposeChat());

  expect(result.current.chatPipeline).toBe(ModelPipeline.textGeneration);
});

test('createChat sets the error state and rethrows on failure', async () => {
  mockFromPath.mockRejectedValue(new Error('load boom'));
  const { result } = renderHook(() => useAiService(), { wrapper });

  await act(async () => {
    await expect(result.current.createChat({ model })).rejects.toThrow(
      'load boom',
    );
  });

  expect(result.current.chatState).toBe(AiModelState.Error);
  expect(result.current.chat.current).toBeUndefined();
});

test('disposeChat destroys the current chat instance', async () => {
  const chat = { stopGeneration: jest.fn(), destroy: jest.fn() };
  mockFromPath.mockResolvedValue(chat);
  const { result } = renderHook(() => useAiService(), { wrapper });
  await act(async () => {
    await result.current.createChat({ model });
  });

  act(() => result.current.disposeChat());

  expect(chat.destroy).toHaveBeenCalledTimes(1);
  expect(result.current.chat.current).toBeUndefined();
  expect(result.current.chatState).toBe(AiModelState.NotLoaded);
});

test('disposeChat stops generation before destroying the chat', async () => {
  const order: string[] = [];
  const chat = {
    stopGeneration: jest.fn(() => order.push('stop')),
    destroy: jest.fn(() => order.push('destroy')),
  };
  mockFromPath.mockResolvedValue(chat);
  const { result } = renderHook(() => useAiService(), { wrapper });
  await act(async () => {
    await result.current.createChat({ model });
  });

  act(() => result.current.disposeChat());

  // Order matters: an in-flight stream must be stopped before its context is freed.
  expect(order).toEqual(['stop', 'destroy']);
  expect(result.current.chat.current).toBeUndefined();
});

test('disposeChat clears the chat even when destroy throws, so a reload works', async () => {
  const chat = {
    stopGeneration: jest.fn(),
    destroy: jest.fn(() => {
      throw new Error('destroy boom');
    }),
  };
  mockFromPath.mockResolvedValueOnce(chat);
  const { result } = renderHook(() => useAiService(), { wrapper });
  await act(async () => {
    await result.current.createChat({ model });
  });

  act(() => result.current.disposeChat());

  // The ref is cleared despite the throw (no zombie instance left behind).
  expect(chat.destroy).toHaveBeenCalledTimes(1);
  expect(result.current.chat.current).toBeUndefined();
  expect(result.current.chatState).toBe(AiModelState.NotLoaded);

  // ...so the next createChat isn't blocked by a stale ref and loads cleanly.
  const next = { destroy: jest.fn() };
  mockFromPath.mockResolvedValueOnce(next);
  await act(async () => {
    await result.current.createChat({ model });
  });
  expect(result.current.chat.current).toBe(next);
  expect(result.current.chatState).toBe(AiModelState.Ready);
});

test('a chat resolving after disposeChat is discarded and destroyed', async () => {
  let resolveFromPath: (chat: unknown) => void;
  mockFromPath.mockReturnValue(
    new Promise(resolve => {
      resolveFromPath = resolve;
    }),
  );
  const { result } = renderHook(() => useAiService(), { wrapper });

  let createPromise: Promise<void> | undefined;
  act(() => {
    createPromise = result.current.createChat({ model });
  });
  act(() => result.current.disposeChat());

  const staleChat = { destroy: jest.fn() };
  await act(async () => {
    resolveFromPath!(staleChat);
    await createPromise;
  });

  expect(staleChat.destroy).toHaveBeenCalledTimes(1);
  expect(result.current.chat.current).toBeUndefined();
  expect(result.current.chatState).toBe(AiModelState.NotLoaded);
});

test('switching models mid-load never runs two Chat.fromPath loads at once', async () => {
  // Each fromPath call hands back its resolver so the test drives completion
  // order explicitly.
  const resolvers: Array<(chat: unknown) => void> = [];
  mockFromPath.mockImplementation(
    () => new Promise(resolve => resolvers.push(resolve)),
  );
  const flushMicrotasks = () =>
    new Promise<void>(resolve => setImmediate(() => resolve()));

  const partFor = (file: string) => [
    {
      url: `file://${file}`,
      fileName: file,
      type: 'chat-model' as const,
      path: '',
      sizeGB: 1,
    },
  ];
  const modelA = buildModel(1, { parts: partFor('a.gguf') });
  const modelB = buildModel(2, { parts: partFor('b.gguf') });

  const { result } = renderHook(() => useAiService(), { wrapper });

  // Start loading A; its fromPath is now in flight.
  act(() => {
    result.current.createChat({ model: modelA });
  });
  expect(mockFromPath).toHaveBeenCalledTimes(1);
  expect(mockFromPath).toHaveBeenLastCalledWith(
    expect.objectContaining({ modelPath: 'file://a.gguf' }),
  );

  // Switch to B (dispose + create) while A is still loading.
  let loadB: Promise<void> | undefined;
  act(() => result.current.disposeChat());
  act(() => {
    loadB = result.current.createChat({ model: modelB });
  });

  // The bug: B's load would call fromPath immediately, running two native
  // loads concurrently. Serialized, B must wait — fromPath is still at 1.
  await act(async () => {
    await flushMicrotasks();
  });
  expect(mockFromPath).toHaveBeenCalledTimes(1);

  // A finishes; superseded, its instance is discarded — and only now does B's
  // load start, so the two loads never overlap.
  const chatA = { destroy: jest.fn() };
  await act(async () => {
    resolvers[0](chatA);
    await flushMicrotasks();
  });
  expect(chatA.destroy).toHaveBeenCalledTimes(1);
  expect(mockFromPath).toHaveBeenCalledTimes(2);
  expect(mockFromPath).toHaveBeenLastCalledWith(
    expect.objectContaining({ modelPath: 'file://b.gguf' }),
  );

  // B becomes the live chat.
  const chatB = { destroy: jest.fn() };
  await act(async () => {
    resolvers[1](chatB);
    await loadB;
  });
  expect(result.current.chat.current).toBe(chatB);
  expect(result.current.chatState).toBe(AiModelState.Ready);
});
