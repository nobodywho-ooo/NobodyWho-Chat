import React from 'react';
import { renderHook, act } from '@testing-library/react-native';

import { buildModel } from 'jest/factories/model';
import {
  mockChatConstruct,
  mockFromPath,
  mockTtsLoad,
  mockSttConstruct,
  mockVadLoad,
} from 'jest/mock/node-modules';
import { Model as NobodyWhoModel } from 'react-native-nobodywho';
import { ModelPipeline } from 'types';

import {
  AiServiceProvider,
  useAiService,
  AiModelState,
  TEARDOWN_SETTLE_MS,
  VAD_MIN_SILENCE_MS,
  VAD_MIN_SPEECH_MS,
  VAD_SAMPLE_RATE,
  VAD_THRESHOLD,
} from '../ai';

// TTS goes through nobodywho's TextToSpeech.load (mocked in jest/mock/node-modules);
// these tests only care that AiService drives it correctly (source path,
// architecture, serialization, teardown).

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
  mockChatConstruct.mockReset();
  mockTtsLoad.mockReset();
  mockSttConstruct.mockReset();
  mockVadLoad.mockReset();
});

// Most tests here dispose a slot and then only flush microtasks, which leaves
// the settle delay that dispose chained on still pending — a live timer that
// outlives the file and makes Jest force-exit the worker ("failed to exit
// gracefully"). One wait at the end is enough to drain every one of them: they
// were all armed earlier, so they are all due within one settle period.
afterAll(() => waitForTeardownSettle());

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

// A second TTS model, for the tests that swap one engine for another.
const otherTtsModel = buildModel(10, {
  pipeline: ModelPipeline.textToSpeech,
  family: 'Supertonic',
  parts: [
    {
      url: 'https://example.com/onnx/vocoder.onnx',
      fileName: 'onnx/vocoder.onnx',
      type: 'tts-file',
      path: '/models/10/onnx/vocoder.onnx',
      sizeGB: 0.1,
    },
  ],
});

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

const sttModel = buildModel(11, {
  pipeline: ModelPipeline.speechToText,
  family: 'Whisper',
  parts: [
    {
      url: 'https://example.com/onnx/encoder_model_int8.onnx',
      fileName: 'onnx/encoder_model_int8.onnx',
      type: 'stt-file',
      path: '/models/11/onnx/encoder_model_int8.onnx',
      sizeGB: 0.1,
    },
  ],
});

test('createChat loads the model and exposes the chat', async () => {
  const chat = { destroy: jest.fn() };
  mockFromPath.mockResolvedValue(chat);
  const { result } = renderHook(() => useAiService(), { wrapper });

  let created: boolean | undefined;
  await act(async () => {
    created = await result.current.slots.chat.create({ model });
  });

  // The slot reports that it is serving the requested model.
  expect(created).toBe(true);

  expect(mockFromPath).toHaveBeenCalledWith(
    expect.objectContaining({
      modelPath: '/mock-documents/models/1/model.gguf',
    }),
  );
  expect(result.current.chatState).toBe(AiModelState.Ready);
  expect(result.current.slots.chat.ref.current).toBe(chat);
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
    await result.current.slots.chat.create({ model: visionModel });
  });

  expect(mockFromPath).toHaveBeenCalledWith(
    expect.objectContaining({
      modelPath: '/mock-documents/models/2/model.gguf',
      projectionModelPath: '/mock-documents/models/2/mmproj.gguf',
    }),
  );
  expect(mockChatConstruct).toHaveBeenCalledWith(
    expect.objectContaining({
      // Bounded by what the device can hold: the mock reports 8 GB, and this
      // model's parts claim 1 + 1x2 = 3 GB on top of the 2 GB OS reserve,
      // leaving 3 GB — the middle tier (see multimodalContextSize).
      contextSize: 2048,
    }),
  );
  expect(result.current.chatPipeline).toBe(ModelPipeline.imageAudioTextToText);
});

// The stepper in the assistant settings lets a context be chosen against one
// model and carried to the next, so the loader is the last place that can stop
// a size the weights were never trained for.
const mockMaxCtx = (value: number) => {
  (NobodyWhoModel as unknown as { mockMaxCtx: number }).mockMaxCtx = value;
};

describe('context sizing against the model ceiling', () => {
  afterEach(() => mockMaxCtx(32768));

  test('clamps a configured context to what the model was trained for', async () => {
    mockMaxCtx(2048);
    mockFromPath.mockResolvedValue({ destroy: jest.fn() });
    const { result } = renderHook(() => useAiService(), { wrapper });

    await act(async () => {
      await result.current.slots.chat.create({ model, contextSize: 8000 });
    });

    expect(mockChatConstruct).toHaveBeenCalledWith(
      expect.objectContaining({ contextSize: 2048 }),
    );
  });

  test('leaves a context the model can serve alone', async () => {
    mockMaxCtx(32768);
    mockFromPath.mockResolvedValue({ destroy: jest.fn() });
    const { result } = renderHook(() => useAiService(), { wrapper });

    await act(async () => {
      await result.current.slots.chat.create({ model, contextSize: 8000 });
    });

    expect(mockChatConstruct).toHaveBeenCalledWith(
      expect.objectContaining({ contextSize: 8000 }),
    );
  });

  test('a ceiling below the engine default pulls an unset context down too', async () => {
    mockMaxCtx(1024);
    mockFromPath.mockResolvedValue({ destroy: jest.fn() });
    const { result } = renderHook(() => useAiService(), { wrapper });

    await act(async () => {
      await result.current.slots.chat.create({ model });
    });

    expect(mockChatConstruct).toHaveBeenCalledWith(
      expect.objectContaining({ contextSize: 1024 }),
    );
  });

  test('a model that reports no usable ceiling is left to the engine default', async () => {
    mockMaxCtx(0);
    mockFromPath.mockResolvedValue({ destroy: jest.fn() });
    const { result } = renderHook(() => useAiService(), { wrapper });

    await act(async () => {
      await result.current.slots.chat.create({ model });
    });

    expect(mockChatConstruct).toHaveBeenCalledWith(
      expect.objectContaining({ contextSize: undefined }),
    );
  });
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
  mockFromPath.mockResolvedValue({
    stopGeneration: jest.fn(),
    destroy: jest.fn(),
  });
  const { result } = renderHook(() => useAiService(), { wrapper });
  await act(async () => {
    await result.current.slots.chat.create({ model: visionModel });
  });
  expect(result.current.chatPipeline).toBe(ModelPipeline.imageTextToText);

  act(() => result.current.slots.chat.dispose());

  expect(result.current.chatPipeline).toBe(ModelPipeline.textGeneration);
});

test('createChat sets the error state and rethrows on failure', async () => {
  mockFromPath.mockRejectedValue(new Error('load boom'));
  const { result } = renderHook(() => useAiService(), { wrapper });

  await act(async () => {
    await expect(result.current.slots.chat.create({ model })).rejects.toThrow(
      'load boom',
    );
  });

  expect(result.current.chatState).toBe(AiModelState.Error);
  expect(result.current.slots.chat.ref.current).toBeUndefined();
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
      await expect(result.current.slots.chat.create({ model })).rejects.toThrow(
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
    await result.current.slots.chat.create({ model });
  });

  // The ref/state clear synchronously; the native destroy is deferred onto the
  // load chain, so flush microtasks before asserting it ran.
  act(() => result.current.slots.chat.dispose());
  expect(result.current.slots.chat.ref.current).toBeUndefined();
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
    await result.current.slots.chat.create({ model });
  });

  act(() => result.current.slots.chat.dispose());
  await act(async () => {
    await flushMicrotasks();
  });

  // Order matters: an in-flight stream must be stopped before its context is freed.
  expect(order).toEqual(['stop', 'destroy']);
  expect(result.current.slots.chat.ref.current).toBeUndefined();
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
    await result.current.slots.chat.create({ model });
  });

  // The ref is cleared synchronously despite the (deferred) destroy throwing.
  act(() => result.current.slots.chat.dispose());
  expect(result.current.slots.chat.ref.current).toBeUndefined();
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
    await result.current.slots.chat.create({ model });
  });
  expect(result.current.slots.chat.ref.current).toBe(next);
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

  let createPromise: Promise<boolean> | undefined;
  act(() => {
    createPromise = result.current.slots.chat.create({ model });
  });
  act(() => result.current.slots.chat.dispose());

  const staleChat = { destroy: jest.fn() };
  let created: boolean | undefined;
  await act(async () => {
    resolveFromPath!(staleChat);
    created = await createPromise;
  });

  expect(staleChat.destroy).toHaveBeenCalledTimes(1);
  expect(result.current.slots.chat.ref.current).toBeUndefined();
  expect(result.current.chatState).toBe(AiModelState.NotLoaded);
  // Resolving without a chat is how the caller learns its load was superseded:
  // reading the empty ref as a failed load was an error screen on every
  // dispose that raced a load (ChatStackNavigator: chat creation failed).
  expect(created).toBe(false);
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
    result.current.slots.chat.create({ model: modelA });
  });
  expect(mockFromPath).toHaveBeenCalledTimes(1);
  expect(mockFromPath).toHaveBeenLastCalledWith(
    expect.objectContaining({ modelPath: '/mock-documents/models/1/a.gguf' }),
  );

  // Switch to B (dispose + create) while A is still loading.
  let loadB: Promise<boolean> | undefined;
  act(() => result.current.slots.chat.dispose());
  act(() => {
    loadB = result.current.slots.chat.create({ model: modelB });
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
  expect(result.current.slots.chat.ref.current).toBe(chatB);
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
    await result.current.slots.chat.create({ model });
  });
  expect(result.current.slots.chat.ref.current).toBe(chatA);

  // Dispose enqueues an async teardown, then a reload starts immediately.
  act(() => result.current.slots.chat.dispose());
  let reload: Promise<boolean> | undefined;
  act(() => {
    reload = result.current.slots.chat.create({ model });
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
  expect(result.current.slots.chat.ref.current).toBe(chatB);
  expect(result.current.chatState).toBe(AiModelState.Ready);
});

test('a reload still settles when another dispose is queued behind it', async () => {
  // Same crash as above, reached the other way round: only the last teardown of
  // a burst pays the settle, and "last" used to be decided by a count that a
  // dispose enqueued *after* the reload was published still incremented. The
  // chat teardown then handed the chain straight to the reload with no settle —
  // which is a model switch followed by backgrounding the app, or by a change
  // to a voice model, within the teardown window.
  const chatA = { stopGeneration: jest.fn(), destroy: jest.fn() };
  const chatB = { destroy: jest.fn() };
  const tts = { destroy: jest.fn() };
  mockFromPath.mockResolvedValueOnce(chatA).mockResolvedValueOnce(chatB);
  mockTtsLoad.mockResolvedValue(tts);
  const { result } = renderHook(() => useAiService(), { wrapper });

  await act(async () => {
    await result.current.slots.chat.create({ model });
    await result.current.slots.tts.create({ model: ttsModel });
  });

  act(() => result.current.slots.chat.dispose());
  let reload: Promise<boolean> | undefined;
  act(() => {
    reload = result.current.slots.chat.create({ model });
    // Lands after the reload was published, so it queues *behind* it — but it
    // is counted as pending the moment it is enqueued.
    result.current.slots.tts.dispose();
  });

  // The chat teardown has run; the reload must still be waiting on the settle.
  await act(async () => {
    await flushMicrotasks();
  });
  expect(chatA.destroy).toHaveBeenCalledTimes(1);
  expect(mockFromPath).toHaveBeenCalledTimes(1);

  await act(async () => {
    await waitForTeardownSettle();
    await reload;
  });
  expect(mockFromPath).toHaveBeenCalledTimes(2);
  expect(result.current.slots.chat.ref.current).toBe(chatB);
});

// Everything the provider hands down sits behind a memo keyed on the slot
// callbacks, so a slot that re-made them each render would re-run every consumer
// effect depending on one — the chat session lifecycle in ChatStackNavigator,
// among others — on every state change. The slot holds its callbacks stable by
// depending on the spec's individual members rather than the spec object, which
// is why the engine specs are module constants (see engines.ts): an `open`
// rebuilt per render would break this even though a spread of a constant spec
// would not.
test('the exposed slots keep their identity across re-renders', async () => {
  mockFromPath.mockResolvedValue({
    stopGeneration: jest.fn(),
    destroy: jest.fn(),
  });
  const { result, rerender } = renderHook(() => useAiService(), { wrapper });

  const before = {
    slots: result.current.slots,
    chat: result.current.slots.chat,
    createChat: result.current.slots.chat.create,
    borrowStt: result.current.slots.stt.borrow,
    disposeAll: result.current.disposeAll,
  };

  const expectUnchanged = () => {
    expect(result.current.slots).toBe(before.slots);
    expect(result.current.slots.chat).toBe(before.chat);
    expect(result.current.slots.chat.create).toBe(before.createChat);
    expect(result.current.slots.stt.borrow).toBe(before.borrowStt);
    expect(result.current.disposeAll).toBe(before.disposeAll);
  };

  // A plain re-render changes nothing.
  rerender(undefined);
  expectUnchanged();

  // Neither does a load, which re-renders the provider through its state.
  await act(async () => {
    await result.current.slots.chat.create({ model });
  });

  expect(result.current.chatState).toBe(AiModelState.Ready);
  expectUnchanged();
});

test('createTts loads the engine from the model directory', async () => {
  const tts = { synthesize: jest.fn(), destroy: jest.fn() };
  mockTtsLoad.mockResolvedValue(tts);
  const { result } = renderHook(() => useAiService(), { wrapper });

  await act(async () => {
    await result.current.slots.tts.create({ model: ttsModel });
  });

  // The loader gets the model's directory (not a single file) plus the
  // architecture derived from the catalogue family — nobodywho can't infer it
  // from an id-named local path the way it does for `hf://…` sources.
  expect(mockTtsLoad).toHaveBeenCalledWith({
    source: '/mock-documents/models/9',
    architecture: 'supertonic',
  });
  expect(result.current.ttsState).toBe(AiModelState.Ready);
  expect(result.current.slots.tts.ref.current).toBe(tts);
  // The loaded architecture is published so playback can branch on it (Kokoro
  // needs chunking, Supertonic does not).
  expect(result.current.ttsArchitecture).toBe('supertonic');
  // The chat slot is untouched.
  expect(result.current.chatState).toBe(AiModelState.NotLoaded);
});

test('createTts refuses a non-TTS model', async () => {
  const { result } = renderHook(() => useAiService(), { wrapper });

  await act(async () => {
    await expect(result.current.slots.tts.create({ model })).rejects.toThrow(
      /is not a valid tts model/,
    );
  });

  expect(mockTtsLoad).not.toHaveBeenCalled();
});

test('createTts fails loudly when a TTS file is missing on disk', async () => {
  const { File } = jest.requireMock('expo-file-system');
  mockTtsLoad.mockResolvedValue({ synthesize: jest.fn(), destroy: jest.fn() });
  File.mockExists = false;
  const { result } = renderHook(() => useAiService(), { wrapper });

  try {
    await act(async () => {
      await expect(
        result.current.slots.tts.create({ model: ttsModel }),
      ).rejects.toThrow(/file .* missing/);
    });

    expect(mockTtsLoad).not.toHaveBeenCalled();
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
  mockTtsLoad.mockResolvedValue(tts);
  const { result } = renderHook(() => useAiService(), { wrapper });

  let ttsLoad: Promise<boolean> | undefined;
  act(() => {
    result.current.slots.chat.create({ model });
  });
  act(() => {
    ttsLoad = result.current.slots.tts.create({ model: ttsModel });
  });

  // The invariant: no second native load while the first is in flight.
  await act(async () => {
    await flushMicrotasks();
  });
  expect(mockFromPath).toHaveBeenCalledTimes(1);
  expect(mockTtsLoad).not.toHaveBeenCalled();

  // Chat finishes -> the chain releases -> the TTS load runs.
  await act(async () => {
    resolveChat({ destroy: jest.fn() });
    await ttsLoad;
  });
  expect(mockTtsLoad).toHaveBeenCalledTimes(1);
  expect(result.current.chatState).toBe(AiModelState.Ready);
  expect(result.current.ttsState).toBe(AiModelState.Ready);
});

test('disposeTts destroys the engine via the teardown chain', async () => {
  const tts = { synthesize: jest.fn(), destroy: jest.fn() };
  mockTtsLoad.mockResolvedValue(tts);
  const { result } = renderHook(() => useAiService(), { wrapper });
  await act(async () => {
    await result.current.slots.tts.create({ model: ttsModel });
  });

  act(() => result.current.slots.tts.dispose());
  expect(result.current.slots.tts.ref.current).toBeUndefined();
  expect(result.current.ttsState).toBe(AiModelState.NotLoaded);
  // The architecture is cleared so a stale value can't survive a model switch.
  expect(result.current.ttsArchitecture).toBeUndefined();

  // The native destroy is deferred onto the load chain.
  await act(async () => {
    await flushMicrotasks();
  });
  expect(tts.destroy).toHaveBeenCalledTimes(1);
});

test('createStt loads the engine from the model directory', async () => {
  const { result } = renderHook(() => useAiService(), { wrapper });

  await act(async () => {
    await result.current.slots.stt.create({ model: sttModel });
  });

  // Whisper is loaded from the model's own directory (folder-based source, like
  // TTS); language is left undefined so the engine auto-detects it, and the
  // quantization hint ("int8") is derived from the downloaded ONNX filename so
  // the loader opens the variant that actually shipped.
  expect(mockSttConstruct).toHaveBeenCalledWith({
    source: '/mock-documents/models/11',
    language: undefined,
    quantization: 'int8',
  });
  expect(result.current.sttState).toBe(AiModelState.Ready);
  expect(result.current.slots.stt.ref.current).toBeDefined();
  // The chat slot is untouched.
  expect(result.current.chatState).toBe(AiModelState.NotLoaded);
});

test('createStt refuses a non-STT model', async () => {
  const { result } = renderHook(() => useAiService(), { wrapper });

  await act(async () => {
    await expect(result.current.slots.stt.create({ model })).rejects.toThrow(
      /is not a valid stt model/,
    );
  });

  expect(mockSttConstruct).not.toHaveBeenCalled();
});

test('createStt fails loudly when an STT file is missing on disk', async () => {
  const { File } = jest.requireMock('expo-file-system');
  File.mockExists = false;
  const { result } = renderHook(() => useAiService(), { wrapper });

  try {
    await act(async () => {
      await expect(
        result.current.slots.stt.create({ model: sttModel }),
      ).rejects.toThrow(/file .* missing/);
    });

    expect(mockSttConstruct).not.toHaveBeenCalled();
    expect(result.current.sttState).toBe(AiModelState.Error);
  } finally {
    File.mockExists = true;
  }
});

test('disposeStt destroys the engine via the teardown chain', async () => {
  const { result } = renderHook(() => useAiService(), { wrapper });
  await act(async () => {
    await result.current.slots.stt.create({ model: sttModel });
  });
  const instance = result.current.slots.stt.ref.current;

  act(() => result.current.slots.stt.dispose());
  expect(result.current.slots.stt.ref.current).toBeUndefined();
  expect(result.current.sttState).toBe(AiModelState.NotLoaded);

  // The native destroy is deferred onto the load chain.
  await act(async () => {
    await flushMicrotasks();
  });
  expect(instance?.destroy).toHaveBeenCalledTimes(1);
});

test('dispose tears down both engines', async () => {
  const chat = { stopGeneration: jest.fn(), destroy: jest.fn() };
  const tts = { synthesize: jest.fn(), destroy: jest.fn() };
  mockFromPath.mockResolvedValue(chat);
  mockTtsLoad.mockResolvedValue(tts);
  const { result } = renderHook(() => useAiService(), { wrapper });
  await act(async () => {
    await result.current.slots.chat.create({ model });
    await result.current.slots.tts.create({ model: ttsModel });
  });

  act(() => result.current.disposeAll());
  expect(result.current.slots.chat.ref.current).toBeUndefined();
  expect(result.current.slots.tts.ref.current).toBeUndefined();

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

test('createVad loads the detector from the model directory at its fixed rate', async () => {
  const { result } = renderHook(() => useAiService(), { wrapper });

  await act(async () => {
    await result.current.slots.vad.create({ model: vadModel });
  });

  // Folder-based source like TTS/STT; the rate is fixed at load time, so every
  // caller has to resample its recording to it (see useSpeechService). The
  // detection thresholds are all passed explicitly — the engine's defaults miss
  // ordinary speech, and a start it never confirms is an end it never reports.
  expect(mockVadLoad).toHaveBeenCalledWith({
    source: '/mock-documents/models/12',
    sampleRate: VAD_SAMPLE_RATE,
    threshold: VAD_THRESHOLD,
    minSpeechDurationMs: VAD_MIN_SPEECH_MS,
    minSilenceDurationMs: VAD_MIN_SILENCE_MS,
  });
  expect(result.current.vadState).toBe(AiModelState.Ready);
  expect(result.current.slots.vad.ref.current).toBeDefined();
  // The chat slot is untouched.
  expect(result.current.chatState).toBe(AiModelState.NotLoaded);
});

test('createVad refuses a non-VAD model', async () => {
  const { result } = renderHook(() => useAiService(), { wrapper });

  await act(async () => {
    await expect(result.current.slots.vad.create({ model })).rejects.toThrow(
      /is not a valid vad model/,
    );
  });

  expect(mockVadLoad).not.toHaveBeenCalled();
});

test('createVad fails loudly when the VAD file is missing on disk', async () => {
  const { File } = jest.requireMock('expo-file-system');
  File.mockExists = false;
  const { result } = renderHook(() => useAiService(), { wrapper });

  try {
    await act(async () => {
      await expect(
        result.current.slots.vad.create({ model: vadModel }),
      ).rejects.toThrow(/file .* missing/);
    });

    expect(mockVadLoad).not.toHaveBeenCalled();
    expect(result.current.vadState).toBe(AiModelState.Error);
  } finally {
    File.mockExists = true;
  }
});

test('disposeVad destroys the detector via the teardown chain', async () => {
  const { result } = renderHook(() => useAiService(), { wrapper });
  await act(async () => {
    await result.current.slots.vad.create({ model: vadModel });
  });
  const instance = result.current.slots.vad.ref.current;

  act(() => result.current.slots.vad.dispose());
  expect(result.current.slots.vad.ref.current).toBeUndefined();
  expect(result.current.vadState).toBe(AiModelState.NotLoaded);

  // The native destroy is deferred onto the load chain.
  await act(async () => {
    await flushMicrotasks();
  });
  expect(instance?.destroy).toHaveBeenCalledTimes(1);

  // Wait out the settle delay the teardown chain schedules, so the suite doesn't
  // end with its timer still pending.
  await act(async () => {
    await waitForTeardownSettle();
  });
});

// --- Slot identity and the in-flight barrier ---------------------------------
// Both behaviours belong to the shared slot protocol (useNativeSlot), so the TTS
// slot stands in for all four.

test('a load for a different model replaces the one already in the slot', async () => {
  const first = { synthesize: jest.fn(), destroy: jest.fn() };
  const second = { synthesize: jest.fn(), destroy: jest.fn() };
  mockTtsLoad.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

  const { result } = renderHook(() => useAiService(), { wrapper });

  // Two loads for different models race without an intervening dispose, so both
  // see an empty slot and the same generation — the shape a background/foreground
  // reload takes when it collides with a model switch.
  await act(async () => {
    const a = result.current.slots.tts.create({ model: ttsModel });
    const b = result.current.slots.tts.create({ model: otherTtsModel });
    await Promise.all([a, b]);
  });

  // The second model wins and the first is freed. Reusing whatever happened to
  // load first would leave the slot serving a model app state no longer points
  // at, with nothing to correct it.
  expect(mockTtsLoad).toHaveBeenCalledTimes(2);
  expect(mockTtsLoad.mock.calls[1][0].source).toContain('10');
  expect(first.destroy).toHaveBeenCalledTimes(1);
  expect(result.current.slots.tts.ref.current).toBe(second);
  expect(result.current.ttsState).toBe(AiModelState.Ready);
});

test('a dispose during a replacement teardown leaves the slot unloaded, not loading', async () => {
  const first = { synthesize: jest.fn(), destroy: jest.fn() };
  const second = { synthesize: jest.fn(), destroy: jest.fn() };
  mockTtsLoad.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

  const { result } = renderHook(() => useAiService(), { wrapper });

  await act(async () => {
    await result.current.slots.tts.create({ model: ttsModel });
  });
  expect(result.current.ttsState).toBe(AiModelState.Ready);

  // Swapping in another model frees the old engine first — a destroy plus a
  // settle delay — which is a wide enough window for a dispose to land in the
  // middle of it (the voice model deselected, or the app backgrounded).
  await act(async () => {
    const swapping = result.current.slots.tts.create({ model: otherTtsModel });
    await flushMicrotasks();
    expect(first.destroy).toHaveBeenCalledTimes(1);

    result.current.slots.tts.dispose();
    await swapping;
  });

  // The abandoned swap must not announce a load it is about to walk away from.
  // Left at Loading, the slot claims a load nobody is running: nothing
  // re-triggers one, and the voice assistant reports the model as still coming
  // up for the rest of the session.
  expect(result.current.ttsState).toBe(AiModelState.NotLoaded);
  expect(result.current.slots.tts.ref.current).toBeUndefined();
  expect(result.current.ttsArchitecture).toBeUndefined();

  // It also stops before loading the replacement at all, rather than allocating
  // an engine only to destroy it again.
  expect(mockTtsLoad).toHaveBeenCalledTimes(1);
  expect(second.destroy).not.toHaveBeenCalled();
});

test('a repeat load of the model already in the slot is reused, not reloaded', async () => {
  const tts = { synthesize: jest.fn(), destroy: jest.fn() };
  mockTtsLoad.mockResolvedValue(tts);

  const { result } = renderHook(() => useAiService(), { wrapper });
  await act(async () => {
    await result.current.slots.tts.create({ model: ttsModel });
  });
  await act(async () => {
    await result.current.slots.tts.create({ model: ttsModel });
  });

  expect(mockTtsLoad).toHaveBeenCalledTimes(1);
  expect(tts.destroy).not.toHaveBeenCalled();
});

test('a teardown waits for borrowed work instead of freeing the handle under it', async () => {
  let finishSynthesis: (wav: Uint8Array) => void = () => undefined;
  const synthesize = jest.fn(
    () =>
      new Promise<Uint8Array>(resolve => {
        finishSynthesis = resolve;
      }),
  );
  const tts = { synthesize, destroy: jest.fn() };
  mockTtsLoad.mockResolvedValue(tts);

  const { result } = renderHook(() => useAiService(), { wrapper });
  await act(async () => {
    await result.current.slots.tts.create({ model: ttsModel });
  });

  let borrowed: Promise<Uint8Array | undefined>;
  act(() => {
    borrowed = result.current.slots.tts.borrow(engine =>
      engine.synthesize('hello'),
    );
  });

  // Disposing mid-call clears the slot immediately, but must not free the
  // native handle: none of these engines can be cancelled, so destroy() here
  // would pull the pointer out from under a running Rust future.
  act(() => result.current.slots.tts.dispose());
  expect(result.current.slots.tts.ref.current).toBeUndefined();

  await act(async () => {
    await flushMicrotasks();
  });
  expect(tts.destroy).not.toHaveBeenCalled();

  // Once the borrowed call lands, the teardown proceeds.
  await act(async () => {
    finishSynthesis(new Uint8Array([1, 2, 3]));
    await borrowed;
    await flushMicrotasks();
  });
  expect(tts.destroy).toHaveBeenCalledTimes(1);
});

test('borrowing an empty slot resolves to undefined rather than throwing', async () => {
  const { result } = renderHook(() => useAiService(), { wrapper });

  await act(async () => {
    await expect(
      result.current.slots.tts.borrow(engine => engine.synthesize('hello')),
    ).resolves.toBeUndefined();
  });
});
