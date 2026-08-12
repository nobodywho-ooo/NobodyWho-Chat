import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Chat,
  SamplerConfig,
  STT,
  Tts,
  TtsArchitecture,
} from 'react-native-nobodywho';
import * as Sentry from '@sentry/react-native';
import {
  downloadedPartPath,
  log,
  modelDirectoryPath,
  resolveSttQuantization,
  sleep,
} from 'helpers';
import {
  ChatPipeline,
  Model,
  ModelPipeline,
  isSttPipeline,
  isTtsPipeline,
  toChatPipeline,
} from 'types';
import { buildChatTools } from './tools';

export enum AiModelState {
  NotLoaded = 'notLoaded',
  Loading = 'loading',
  Ready = 'ready',
  Error = 'error',
}

interface AiServiceState {
  chatState: AiModelState;
  chatPipeline: ChatPipeline;
  ttsState: AiModelState;
  ttsArchitecture?: TtsArchitecture;
  sttState: AiModelState;
}

interface AiServiceContextValue extends AiServiceState {
  chat: React.RefObject<Chat | undefined>;
  tts: React.RefObject<Tts | undefined>;
  stt: React.RefObject<STT | undefined>;

  createChat: (opts: {
    model: Model;
    useGpu?: boolean;
    systemPrompt?: string;
    sampler?: SamplerConfig;
    contextSize?: number;
    thinking?: boolean;
    toolCalling?: boolean;
  }) => Promise<void>;
  disposeChat: () => void;
  createTts: (opts: {
    model: Model;
    voice?: string;
    language?: string;
  }) => Promise<void>;
  disposeTts: () => void;
  createStt: (opts: { model: Model; language?: string }) => Promise<void>;
  disposeStt: () => void;
  dispose: () => void;
}

const AiServiceContext = createContext<AiServiceContextValue | undefined>(
  undefined,
);

const _initialState: AiServiceState = {
  chatState: AiModelState.NotLoaded,
  chatPipeline: ModelPipeline.textGeneration,
  ttsState: AiModelState.NotLoaded,
  ttsArchitecture: undefined,
  sttState: AiModelState.NotLoaded,
};

// chat.destroy() is fire-and-forget: it signals the native worker thread but
// returns before the llama_context / Metal buffers are actually freed, with no
// completion signal to await. So after a teardown we yield the event loop and
// wait this long before the next Chat.fromPath allocates — otherwise the new
// context starts reserving Metal buffers while the old one is still releasing
// them, which on multimodal models (large footprint) makes a buffer allocation
// return NULL and crashes inside ggml-metal. Heuristic, not a real wait; bump
// it if field crashes persist.
export const TEARDOWN_SETTLE_MS = 500;

export const MULTIMODAL_CONTEXT_SIZE = 2048;

export const AiServiceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AiServiceState>(_initialState);

  const chatRef = useRef<Chat | undefined>(undefined);
  const ttsRef = useRef<Tts | undefined>(undefined);
  const sttRef = useRef<STT | undefined>(undefined);

  // Bumped on every dispose. A createChat that resolves after its generation
  // passed must discard its instance instead of resurrecting a disposed chat.
  const chatGeneration = useRef(0);
  const ttsGeneration = useRef(0);
  const sttGeneration = useRef(0);

  const nativeLoadRef = useRef<Promise<unknown> | undefined>(undefined);

  // Run a chat teardown serialized on the same chain as loads, so the next
  // createChat's `await previousLoad` also waits out the teardown + settle
  // delay before allocating a new context. Without this, a dispose (e.g. on
  // backgrounding) followed by a reload (on returning) overlaps the old
  // context's native release with the new one's Metal allocation.
  const enqueueTeardown = useCallback((teardown: () => void) => {
    const previous = nativeLoadRef.current;
    const barrier = (async () => {
      // Serialize behind any in-flight load before touching the backend.
      if (previous) {
        await previous;
      }

      try {
        teardown();
      } catch (error) {
        log('AiService teardown failed', error, { capture: true });
      }
      // Give the worker thread time to free the llama_context / GPU buffers
      // before the next fromPath allocates (destroy() exposes no done signal).
      await sleep(TEARDOWN_SETTLE_MS);
    })();
    // Publish so the next createChat (or teardown) serializes behind us; swallow
    // rejections so one failure can't reject the next `await previousLoad`.
    nativeLoadRef.current = barrier.catch(() => undefined);
    return barrier;
  }, []);

  const createChat = useCallback(
    async (opts: {
      model: Model;
      useGpu?: boolean;
      systemPrompt?: string;
      sampler?: SamplerConfig;
      contextSize?: number;
      thinking?: boolean;
      toolCalling?: boolean;
    }) => {
      if (chatRef.current) {
        return;
      }

      const generation = chatGeneration.current;
      const previousLoad = nativeLoadRef.current;

      const load = async () => {
        // Wait for any in-flight load to fully settle (and release the native
        // backend) before touching it again. When idle there's nothing to wait
        // for, so the first load reaches fromPath in the same tick.
        if (previousLoad) {
          await previousLoad;
        }

        // A dispose or a newer load superseded us while we waited — bail before
        // starting an unwanted load. A sibling load of the same model that
        // already produced a chat is reused rather than loaded a second time.
        if (generation !== chatGeneration.current || chatRef.current) {
          return;
        }

        setState(s => ({ ...s, chatState: AiModelState.Loading }));

        const { model } = opts;

        const chatPart = model.parts.find(part => part.type === 'chat-model');
        const chatModelPath = chatPart
          ? downloadedPartPath(model.id, chatPart.fileName)
          : null;

        if (!chatModelPath) {
          throw new Error(
            `AiService: chat-model file missing for model ${model.id} (${model.name}) — re-download required`,
          );
        }

        const projectionPart =
          model.pipeline !== ModelPipeline.textGeneration
            ? model.parts.find(part => part.type === 'projection-model')
            : undefined;

        const projectionModelPath = projectionPart
          ? (downloadedPartPath(model.id, projectionPart.fileName) ?? undefined)
          : undefined;

        if (projectionPart && !projectionModelPath) {
          throw new Error(
            `AiService: projection-model file missing for model ${model.id} (${model.name}) — re-download required`,
          );
        }

        const tools =
          model.toolCalling &&
          (opts.toolCalling ?? true) &&
          model.pipeline === ModelPipeline.textGeneration
            ? buildChatTools()
            : undefined;

        // Multimodal contexts are capped: larger ones exhaust Metal buffer
        const contextSize =
          projectionModelPath !== undefined
            ? Math.min(
                opts.contextSize ?? MULTIMODAL_CONTEXT_SIZE,
                MULTIMODAL_CONTEXT_SIZE,
              )
            : opts.contextSize;

        const chat = await Chat.fromPath({
          modelPath: chatModelPath,
          projectionModelPath,
          useGpu: opts?.useGpu ?? true,
          tools,
          systemPrompt: opts?.systemPrompt,
          sampler: opts?.sampler,
          contextSize,
          templateVariables: {
            enable_thinking: model.thinking && (opts.thinking ?? true),
          },
        });

        if (generation !== chatGeneration.current) {
          // Disposed while loading; a newer chat may already be in flight.
          try {
            chat.destroy();
          } catch (error) {
            log('AiService superseded chat destroy failed', error, {
              capture: true,
            });
          }
          // This IIFE owns nativeLoadRef, so we can't enqueueTeardown (self-wait).
          // The newer load already awaits this IIFE via `await previousLoad`, so
          // settling here delays its fromPath until our GPU buffers are freed.
          await sleep(TEARDOWN_SETTLE_MS);
          return;
        }

        chatRef.current = chat;
        const chatPipeline = toChatPipeline(model.pipeline);

        setState(s => ({
          ...s,
          chatState: AiModelState.Ready,
          chatPipeline: chatPipeline,
        }));
      };

      // Invoke the load exactly once. Publish that single promise so the next
      // createChat serializes behind it; the stored handle swallows rejections
      // so one failed load can't reject the next load's `await previousLoad`.
      // (Calling load() a second time here would run two native loads at once —
      // the concurrent-load deadlock this whole chain exists to prevent.)
      const loadPromise = load();
      nativeLoadRef.current = loadPromise.catch(() => undefined);

      try {
        await loadPromise;
      } catch (error) {
        log('AiService create chat', error, { capture: true });
        // Only the generation that still owns the chat may surface the error; a
        // superseded load must not flip a newer load's state to Error.
        if (generation === chatGeneration.current) {
          setState(s => ({ ...s, chatState: AiModelState.Error }));
        }
        throw error;
      }
    },
    [],
  );

  const disposeChat = useCallback(() => {
    chatGeneration.current += 1;
    const instance = chatRef.current;
    chatRef.current = undefined;

    if (instance) {
      enqueueTeardown(() => {
        // Stop any in-flight generation before freeing the context, so a stream
        // still being consumed (e.g. ChatScreen mid-send during a model switch)
        // ends cleanly instead of the context being torn out. destroy() runs in
        // finally so it still happens if stopGeneration throws; enqueueTeardown's
        // own try/catch logs whichever call throws.
        try {
          instance.stopGeneration();
        } finally {
          instance.destroy();
        }
      });
    }

    setState(s => ({
      ...s,
      chatState: AiModelState.NotLoaded,
      chatPipeline: ModelPipeline.textGeneration,
    }));
  }, [enqueueTeardown]);

  const createTts = useCallback(
    async (opts: { model: Model; voice?: string; language?: string }) => {
      if (ttsRef.current) {
        return;
      }

      const { model, voice, language } = opts;

      if (!isTtsPipeline(model.pipeline)) {
        throw new Error(
          `AiService: model ${model.id} (${model.name}) is not a TTS model`,
        );
      }

      const generation = ttsGeneration.current;
      const previousLoad = nativeLoadRef.current;

      const load = async () => {
        if (previousLoad) {
          await previousLoad;
        }

        if (generation !== ttsGeneration.current || ttsRef.current) {
          return;
        }

        setState(s => ({ ...s, ttsState: AiModelState.Loading }));

        const missingPart = model.parts.find(
          part => downloadedPartPath(model.id, part.fileName) === null,
        );

        if (missingPart) {
          throw new Error(
            `AiService: TTS file ${missingPart.fileName} missing for model ${model.id} (${model.name}) — re-download required`,
          );
        }

        // Downloaded models live in id-named dirs (…/models/7), so we can't
        // infer the architecture from the path — derive it from family
        // ("Supertonic" -> supertonic) and reuse it as the loaded architecture
        // we publish below.
        const architecture = model.family.toLowerCase() as TtsArchitecture;
        const tts = await Tts.load({
          source: modelDirectoryPath(model.id),
          architecture,
          // Load-time options (Supertonic): omitted keys keep the engine's
          // defaults, so a model with no voice/language selection is unaffected.
          voice,
          language,
        });

        if (generation !== ttsGeneration.current) {
          try {
            tts.destroy();
          } catch (error) {
            log('AiService superseded tts destroy failed', error, {
              capture: true,
            });
          }
          await sleep(TEARDOWN_SETTLE_MS);
          return;
        }

        ttsRef.current = tts;
        setState(s => ({
          ...s,
          ttsState: AiModelState.Ready,
          ttsArchitecture: architecture,
        }));
      };

      const loadPromise = load();
      nativeLoadRef.current = loadPromise.catch(() => undefined);

      try {
        await loadPromise;
      } catch (error) {
        log('AiService create tts', error, { capture: true });
        if (generation === ttsGeneration.current) {
          setState(s => ({ ...s, ttsState: AiModelState.Error }));
        }
        throw error;
      }
    },
    [],
  );

  const disposeTts = useCallback(() => {
    ttsGeneration.current += 1;
    const instance = ttsRef.current;
    ttsRef.current = undefined;

    if (instance) {
      enqueueTeardown(() => instance.destroy());
    }

    setState(s => ({
      ...s,
      ttsState: AiModelState.NotLoaded,
      ttsArchitecture: undefined,
    }));
  }, [enqueueTeardown]);

  const createStt = useCallback(
    async (opts: { model: Model; language?: string }) => {
      if (sttRef.current) {
        return;
      }

      const { model, language } = opts;

      if (!isSttPipeline(model.pipeline)) {
        throw new Error(
          `AiService: model ${model.id} (${model.name}) is not an STT model`,
        );
      }

      const generation = sttGeneration.current;
      const previousLoad = nativeLoadRef.current;

      const load = async () => {
        if (previousLoad) {
          await previousLoad;
        }

        if (generation !== sttGeneration.current || sttRef.current) {
          return;
        }

        setState(s => ({ ...s, sttState: AiModelState.Loading }));

        const missingPart = model.parts.find(
          part => downloadedPartPath(model.id, part.fileName) === null,
        );

        if (missingPart) {
          throw new Error(
            `AiService: STT file ${missingPart.fileName} missing for model ${model.id} (${model.name}) — re-download required`,
          );
        }

        // Whisper is loaded from the model's own directory (…/models/<id>),
        // the same folder-based source TTS uses. `language` is optional: when
        // omitted the engine auto-detects the spoken language (passing an ISO
        // 639-1 code skips detection and is faster). `quantization` must match
        // the ONNX variant that was downloaded (e.g. "int8"), otherwise the
        // loader looks for the engine's default unsuffixed weights, which the
        // model doesn't ship, and fails to load.
        const stt = new STT({
          source: modelDirectoryPath(model.id),
          language,
          quantization: resolveSttQuantization(model),
        });

        if (generation !== sttGeneration.current) {
          try {
            stt.destroy();
          } catch (error) {
            log('AiService superseded stt destroy failed', error, {
              capture: true,
            });
          }
          await sleep(TEARDOWN_SETTLE_MS);
          return;
        }

        sttRef.current = stt;
        setState(s => ({ ...s, sttState: AiModelState.Ready }));
      };

      const loadPromise = load();
      nativeLoadRef.current = loadPromise.catch(() => undefined);

      try {
        await loadPromise;
      } catch (error) {
        log('AiService create stt', error, { capture: true });
        if (generation === sttGeneration.current) {
          setState(s => ({ ...s, sttState: AiModelState.Error }));
        }
        throw error;
      }
    },
    [],
  );

  const disposeStt = useCallback(() => {
    sttGeneration.current += 1;
    const instance = sttRef.current;
    sttRef.current = undefined;

    if (instance) {
      enqueueTeardown(() => instance.destroy());
    }

    setState(s => ({ ...s, sttState: AiModelState.NotLoaded }));
  }, [enqueueTeardown]);

  const dispose = useCallback(() => {
    chatGeneration.current += 1;
    ttsGeneration.current += 1;
    sttGeneration.current += 1;
    // Clear the refs BEFORE destroying so a throwing destroy() can't leave a
    // stale instance that blocks the next createChat()/createTts()/createStt().
    const chatInstance = chatRef.current;
    chatRef.current = undefined;
    const ttsInstance = ttsRef.current;
    ttsRef.current = undefined;
    const sttInstance = sttRef.current;
    sttRef.current = undefined;

    // The Chat can overlap a future chat load, so route its teardown through
    // the load chain (stop generation first, since only Chat streams).
    if (chatInstance) {
      enqueueTeardown(() => {
        // Stop any in-flight generation before freeing the context (only Chat
        // streams). destroy() runs in finally so it still happens if
        // stopGeneration throws — otherwise the native context leaks and the
        // backend is never released for the next load. enqueueTeardown's own
        // try/catch logs whichever call throws.
        try {
          chatInstance.stopGeneration();
        } finally {
          chatInstance.destroy();
        }
      });
    }

    // Second enqueue serializes behind the chat teardown on the same chain.
    if (ttsInstance) {
      enqueueTeardown(() => ttsInstance.destroy());
    }

    // Third enqueue serializes behind the tts teardown on the same chain.
    if (sttInstance) {
      enqueueTeardown(() => sttInstance.destroy());
    }

    setState(_initialState);
  }, [enqueueTeardown]);

  const value = useMemo<AiServiceContextValue>(
    () => ({
      ...state,
      chat: chatRef,
      tts: ttsRef,
      stt: sttRef,
      createChat,
      disposeChat,
      createTts,
      disposeTts,
      createStt,
      disposeStt,
      dispose,
    }),
    [
      state,
      createChat,
      disposeChat,
      createTts,
      disposeTts,
      createStt,
      disposeStt,
      dispose,
    ],
  );

  return (
    <AiServiceContext.Provider value={value}>
      {children}
    </AiServiceContext.Provider>
  );
};

export const useAiService = (): AiServiceContextValue => {
  const ctx = useContext(AiServiceContext);
  if (!ctx) {
    Sentry.captureMessage('AiServiceContextValue not available');
    throw new Error('useAiService must be used within an AiServiceProvider');
  }
  return ctx;
};
