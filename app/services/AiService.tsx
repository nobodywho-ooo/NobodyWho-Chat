import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Chat, SamplerConfig, Tts } from 'react-native-nobodywho';
import * as Sentry from '@sentry/react-native';
import {
  downloadedPartPath,
  log,
  modelDirectoryPath,
  sleep,
  getTtsArchitecture,
} from 'helpers';
import {
  ChatPipeline,
  Model,
  ModelPipeline,
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
}

interface AiServiceContextValue extends AiServiceState {
  chat: React.RefObject<Chat | undefined>;
  tts: React.RefObject<Tts | undefined>;

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
  createTts: (opts: { model: Model }) => Promise<void>;
  disposeTts: () => void;
  dispose: () => void;
}

const AiServiceContext = createContext<AiServiceContextValue | undefined>(
  undefined,
);

const _initialState: AiServiceState = {
  chatState: AiModelState.NotLoaded,
  chatPipeline: ModelPipeline.textGeneration,
  ttsState: AiModelState.NotLoaded,
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

  // Bumped on every dispose. A createChat that resolves after its generation
  // passed must discard its instance instead of resurrecting a disposed chat.
  const chatGeneration = useRef(0);
  const ttsGeneration = useRef(0);

  // The in-flight native load (undefined when idle), so the next load can
  // serialize behind it. Neither Chat.fromPath nor Tts.load has cancellation,
  // and a dispose can't tear down a load that hasn't returned its instance
  // yet — so without serializing, switching models mid-load would run two
  // heavy native loads at once. That deadlocks (or OOMs) the native backend,
  // and the app then hangs on "Loading…" forever — even across restarts, since
  // the same model stays persisted as in use. Chaining each load onto the
  // previous one guarantees only one native load runs at a time, so a
  // superseded load fully releases the backend before the next begins. Chat
  // and TTS loads share this single chain: the invariant is per-backend, not
  // per-engine.
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

      const load = (async () => {
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
      })();

      // Publish this load so the next createChat serializes behind it. The
      // stored handle swallows rejections so one failed load can't reject the
      // next load's `await previousLoad`.
      nativeLoadRef.current = load.catch(() => undefined);

      try {
        await load;
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
        try {
          // Stop any in-flight generation before freeing the context, so a
          // stream still being consumed (e.g. ChatScreen mid-send during a
          // model switch) ends cleanly instead of the context being torn out.
          instance.stopGeneration();
        } catch (error) {
          log('AiService disposeChat stopGeneration failed', error, {
            capture: true,
          });
        }
        instance.destroy();
      });
    }

    setState(s => ({
      ...s,
      chatState: AiModelState.NotLoaded,
      chatPipeline: ModelPipeline.textGeneration,
    }));
  }, [enqueueTeardown]);

  const createTts = useCallback(async (opts: { model: Model }) => {
    if (ttsRef.current) {
      return;
    }

    const { model } = opts;
    if (!isTtsPipeline(model.pipeline)) {
      throw new Error(
        `AiService: model ${model.id} (${model.name}) is not a TTS model`,
      );
    }

    const generation = ttsGeneration.current;
    const previousLoad = nativeLoadRef.current;

    const load = (async () => {
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

      const tts = await Tts.load({
        source: modelDirectoryPath(model.id),
        architecture: getTtsArchitecture(model.family),
      });

      if (generation !== ttsGeneration.current) {
        // TODO: might be needed - check
        // Disposed while loading — free the instance we just built and settle
        // before the next native load allocates.
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
      setState(s => ({ ...s, ttsState: AiModelState.Ready }));
    })();

    nativeLoadRef.current = load.catch(() => undefined);

    try {
      await load;
    } catch (error) {
      log('AiService create tts', error, { capture: true });
      if (generation === ttsGeneration.current) {
        setState(s => ({ ...s, ttsState: AiModelState.Error }));
      }
      throw error;
    }
  }, []);

  const disposeTts = useCallback(() => {
    ttsGeneration.current += 1;
    const instance = ttsRef.current;
    ttsRef.current = undefined;

    if (instance) {
      // TODO: might be needed - check
      enqueueTeardown(() => instance.destroy());
    }

    setState(s => ({ ...s, ttsState: AiModelState.NotLoaded }));
  }, [enqueueTeardown]);

  const dispose = useCallback(() => {
    chatGeneration.current += 1;
    ttsGeneration.current += 1;
    // Clear the refs BEFORE destroying so a throwing destroy() can't leave a
    // stale instance that blocks the next createChat()/createTts().
    const chatInstance = chatRef.current;
    chatRef.current = undefined;
    const ttsInstance = ttsRef.current;
    ttsRef.current = undefined;

    // The Chat can overlap a future chat load, so route its teardown through
    // the load chain (stop generation first, since only Chat streams).
    if (chatInstance) {
      enqueueTeardown(() => {
        try {
          chatInstance.stopGeneration();
        } catch (error) {
          log('AiService dispose stopGeneration failed', error, {
            capture: true,
          });
        }
        chatInstance.destroy();
      });
    }

    // Second enqueue serializes behind the chat teardown on the same chain.
    if (ttsInstance) {
      enqueueTeardown(() => ttsInstance.destroy());
    }

    setState(_initialState);
  }, [enqueueTeardown]);

  const value = useMemo<AiServiceContextValue>(
    () => ({
      ...state,
      chat: chatRef,
      tts: ttsRef,
      createChat,
      disposeChat,
      createTts,
      disposeTts,
      dispose,
    }),
    [state, createChat, disposeChat, createTts, disposeTts, dispose],
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
