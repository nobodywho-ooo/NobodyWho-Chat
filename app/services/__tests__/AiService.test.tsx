import React from 'react';
import { renderHook, act } from '@testing-library/react-native';

import { buildModel } from 'jest/factories/model';
import { mockFromPath } from 'jest/mock/node-modules';
import { ModelPipeline } from 'types';

import {
  AiServiceProvider,
  useAiService,
  AiModelState,
  MULTIMODAL_CONTEXT_SIZE,
  TEARDOWN_SETTLE_MS,
} from '../AiService';

// The TTS engine facade is mocked at its boundary: the installed nobodywho
// package doesn't ship Tts yet, and these tests only care that AiService
// drives the facade correctly (paths, serialization, teardown).
const mockLoadTtsEngine = jest.fn();
jest.mock('../ttsEngine', () => ({
  loadTtsEngine: (source: string) => mockLoadTtsEngine(source),
  isTtsEngineAvailable: () => true,
}));

(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;

// chat teardown is deferred onto the load chain (destroy + a settle delay), so
// tests flush microtasks to observe the destroy, and wait out the settle when
// asserting that the next load only starts afterwards.
const flushMicrotasks = () =>
  new Promise<void>(resolve => setImmediate(() => resolve()));
const waitForTeardownSettle = () =>
  new Promise<void>(resolve => setTimeout(resolve, TEARDOWN_SETTLE_MS + 50));

const model = buildModel(1, {
  parts: [
    {
      url: 'https://example.com/model.gguf',
      fileName: 'model.gguf',
      type: 'chat-model',
      path: '/models/model.gguf',
      sizeGB: 1,
    },
  ],
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AiServiceProvider>{children}</AiServiceProvider>
);

beforeEach(() => {
  mockFromPath.mockReset();
  mockLoadTtsEngine.mockReset();
});

const ttsModel = buildModel(9, {
  pipeline: ModelPipeline.textToSpeech,
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

test('createChat loads the model and exposes the chat', async () => {
  const chat = { destroy: jest.fn() };
  mockFromPath.mockResolvedValue(chat);
  const { result } = renderHook(() => useAiService(), { wrapper });

  await act(async () => {
    await result.current.createChat({ model });
  });

  expect(mockFromPath).toHaveBeenCalledWith(
    expect.objectContaining({ modelPath: '/mock-documents/models/1/model.gguf' }),
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
        url: 'https://example.com/model.gguf',
        fileName: 'model.gguf',
        type: 'chat-model',
        path: '/models/model.gguf',
        sizeGB: 1,
      },
      {
        url: 'https://example.com/mmproj.gguf',
        fileName: 'mmproj.gguf',
        type: 'projection-model',
        path: '/models/mmproj.gguf',
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
      modelPath: '/mock-documents/models/2/model.gguf',
      projectionModelPath: '/mock-documents/models/2/mmproj.gguf',
      // Multimodal loads are bounded to keep the Metal allocation small.
      contextSize: MULTIMODAL_CONTEXT_SIZE,
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

test('createChat fails loudly when the model file is missing on disk', async () => {
  // A persisted absolute path can go stale (the iOS container UUID changes on
  // every install), so the part file may be absent at load time. The chat must
  // never get handed a path that collapses to the models directory — it must
  // surface a clear error instead.
  const { File } = jest.requireMock('expo-file-system');
  const chat = { destroy: jest.fn() };
  mockFromPath.mockResolvedValue(chat);
  File.mockExists = false;
  const { result } = renderHook(() => useAiService(), { wrapper });

  try {
    await act(async () => {
      await expect(result.current.createChat({ model })).rejects.toThrow(
        /chat-model file missing/,
      );
    });

    // Never reached the native loader with a bogus (directory) path.
    expect(mockFromPath).not.toHaveBeenCalled();
    expect(result.current.chatState).toBe(AiModelState.Error);
  } finally {
    File.mockExists = true;
  }
});

test('disposeChat destroys the current chat instance', async () => {
  const chat = { stopGeneration: jest.fn(), destroy: jest.fn() };
  mockFromPath.mockResolvedValue(chat);
  const { result } = renderHook(() => useAiService(), { wrapper });
  await act(async () => {
    await result.current.createChat({ model });
  });

  // The ref/state clear synchronously; the native destroy is deferred onto the
  // load chain, so flush microtasks before asserting it ran.
  act(() => result.current.disposeChat());
  expect(result.current.chat.current).toBeUndefined();
  expect(result.current.chatState).toBe(AiModelState.NotLoaded);

  await act(async () => {
    await flushMicrotasks();
  });
  expect(chat.destroy).toHaveBeenCalledTimes(1);
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
  await act(async () => {
    await flushMicrotasks();
  });

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

  // The ref is cleared synchronously despite the (deferred) destroy throwing.
  act(() => result.current.disposeChat());
  expect(result.current.chat.current).toBeUndefined();
  expect(result.current.chatState).toBe(AiModelState.NotLoaded);

  await act(async () => {
    await flushMicrotasks();
  });
  expect(chat.destroy).toHaveBeenCalledTimes(1);

  // ...and a throwing teardown can't wedge the chain, so the next createChat
  // still loads cleanly (after waiting out the teardown settle).
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

  const partFor = (file: string) => [
    {
      url: `https://example.com/${file}`,
      fileName: file,
      type: 'chat-model' as const,
      path: `/models/${file}`,
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
    expect.objectContaining({ modelPath: '/mock-documents/models/1/a.gguf' }),
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

  // A finishes; superseded, its instance is discarded immediately. But it must
  // also let its teardown settle before releasing the chain, so B's load does
  // not start in the same tick (no overlap with A's native release).
  const chatA = { destroy: jest.fn() };
  await act(async () => {
    resolvers[0](chatA);
    await flushMicrotasks();
  });
  expect(chatA.destroy).toHaveBeenCalledTimes(1);
  expect(mockFromPath).toHaveBeenCalledTimes(1);

  // Only after the teardown settle does B's load actually allocate.
  await act(async () => {
    await waitForTeardownSettle();
    await flushMicrotasks();
  });
  expect(mockFromPath).toHaveBeenCalledTimes(2);
  expect(mockFromPath).toHaveBeenLastCalledWith(
    expect.objectContaining({ modelPath: '/mock-documents/models/2/b.gguf' }),
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

test('a reload waits for the previous chat teardown to settle before allocating', async () => {
  // The crash this guards against: a dispose (e.g. on backgrounding) followed by
  // a reload (on returning) overlapping the old context's native release with
  // the new one's Metal allocation. The new load must wait out the teardown.
  const chatA = { stopGeneration: jest.fn(), destroy: jest.fn() };
  const chatB = { destroy: jest.fn() };
  mockFromPath.mockResolvedValueOnce(chatA).mockResolvedValueOnce(chatB);
  const { result } = renderHook(() => useAiService(), { wrapper });

  await act(async () => {
    await result.current.createChat({ model });
  });
  expect(result.current.chat.current).toBe(chatA);

  // Dispose enqueues an async teardown, then a reload starts immediately.
  act(() => result.current.disposeChat());
  let reload: Promise<void> | undefined;
  act(() => {
    reload = result.current.createChat({ model });
  });

  // Teardown destroys the old chat, but the new context must not allocate yet.
  await act(async () => {
    await flushMicrotasks();
  });
  expect(chatA.destroy).toHaveBeenCalledTimes(1);
  expect(mockFromPath).toHaveBeenCalledTimes(1);

  // Only after the settle does the reload allocate the new context.
  await act(async () => {
    await waitForTeardownSettle();
    await reload;
  });
  expect(mockFromPath).toHaveBeenCalledTimes(2);
  expect(result.current.chat.current).toBe(chatB);
  expect(result.current.chatState).toBe(AiModelState.Ready);
});

test('createTts loads the engine from the model directory', async () => {
  const tts = { synthesize: jest.fn(), destroy: jest.fn() };
  mockLoadTtsEngine.mockResolvedValue(tts);
  const { result } = renderHook(() => useAiService(), { wrapper });

  await act(async () => {
    await result.current.createTts({ model: ttsModel });
  });

  // The engine gets the model's directory, not any single file.
  expect(mockLoadTtsEngine).toHaveBeenCalledWith('/mock-documents/models/9');
  expect(result.current.ttsState).toBe(AiModelState.Ready);
  expect(result.current.tts.current).toBe(tts);
  // The chat slot is untouched.
  expect(result.current.chatState).toBe(AiModelState.NotLoaded);
});

test('createTts refuses a non-TTS model', async () => {
  const { result } = renderHook(() => useAiService(), { wrapper });

  await act(async () => {
    await expect(result.current.createTts({ model })).rejects.toThrow(
      /is not a TTS model/,
    );
  });

  expect(mockLoadTtsEngine).not.toHaveBeenCalled();
});

test('createTts fails loudly when a TTS file is missing on disk', async () => {
  const { File } = jest.requireMock('expo-file-system');
  mockLoadTtsEngine.mockResolvedValue({ synthesize: jest.fn(), destroy: jest.fn() });
  File.mockExists = false;
  const { result } = renderHook(() => useAiService(), { wrapper });

  try {
    await act(async () => {
      await expect(result.current.createTts({ model: ttsModel })).rejects.toThrow(
        /TTS file .* missing/,
      );
    });

    expect(mockLoadTtsEngine).not.toHaveBeenCalled();
    expect(result.current.ttsState).toBe(AiModelState.Error);
  } finally {
    File.mockExists = true;
  }
});

test('createTts serializes behind an in-flight chat load on the shared chain', async () => {
  // Chat load in flight: fromPath is pending until we resolve it.
  let resolveChat!: (chat: unknown) => void;
  mockFromPath.mockImplementation(
    () => new Promise(resolve => (resolveChat = resolve)),
  );
  const tts = { synthesize: jest.fn(), destroy: jest.fn() };
  mockLoadTtsEngine.mockResolvedValue(tts);
  const { result } = renderHook(() => useAiService(), { wrapper });

  let ttsLoad: Promise<void> | undefined;
  act(() => {
    result.current.createChat({ model });
  });
  act(() => {
    ttsLoad = result.current.createTts({ model: ttsModel });
  });

  // The invariant: no second native load while the first is in flight.
  await act(async () => {
    await flushMicrotasks();
  });
  expect(mockFromPath).toHaveBeenCalledTimes(1);
  expect(mockLoadTtsEngine).not.toHaveBeenCalled();

  // Chat finishes -> the chain releases -> the TTS load runs.
  await act(async () => {
    resolveChat({ destroy: jest.fn() });
    await ttsLoad;
  });
  expect(mockLoadTtsEngine).toHaveBeenCalledTimes(1);
  expect(result.current.chatState).toBe(AiModelState.Ready);
  expect(result.current.ttsState).toBe(AiModelState.Ready);
});

test('disposeTts destroys the engine via the teardown chain', async () => {
  const tts = { synthesize: jest.fn(), destroy: jest.fn() };
  mockLoadTtsEngine.mockResolvedValue(tts);
  const { result } = renderHook(() => useAiService(), { wrapper });
  await act(async () => {
    await result.current.createTts({ model: ttsModel });
  });

  act(() => result.current.disposeTts());
  expect(result.current.tts.current).toBeUndefined();
  expect(result.current.ttsState).toBe(AiModelState.NotLoaded);

  // The native destroy is deferred onto the load chain.
  await act(async () => {
    await flushMicrotasks();
  });
  expect(tts.destroy).toHaveBeenCalledTimes(1);
});

test('dispose tears down both engines', async () => {
  const chat = { stopGeneration: jest.fn(), destroy: jest.fn() };
  const tts = { synthesize: jest.fn(), destroy: jest.fn() };
  mockFromPath.mockResolvedValue(chat);
  mockLoadTtsEngine.mockResolvedValue(tts);
  const { result } = renderHook(() => useAiService(), { wrapper });
  await act(async () => {
    await result.current.createChat({ model });
    await result.current.createTts({ model: ttsModel });
  });

  act(() => result.current.dispose());
  expect(result.current.chat.current).toBeUndefined();
  expect(result.current.tts.current).toBeUndefined();

  // Both teardowns are chained (chat first, then tts after its settle).
  await act(async () => {
    await flushMicrotasks();
  });
  expect(chat.destroy).toHaveBeenCalledTimes(1);
  await act(async () => {
    await waitForTeardownSettle();
    await flushMicrotasks();
  });
  expect(tts.destroy).toHaveBeenCalledTimes(1);
});
