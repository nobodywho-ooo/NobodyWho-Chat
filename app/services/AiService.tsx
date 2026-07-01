import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Chat, SamplerConfig } from 'react-native-nobodywho';
import * as Sentry from '@sentry/react-native';
import { downloadedPartPath, log, sleep } from 'helpers';
import { ChatPipeline, Model, ModelPipeline, toChatPipeline } from 'types';
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
}

interface AiServiceContextValue extends AiServiceState {
  chat: React.RefObject<Chat | undefined>;

  createChat: (opts: {
    model: Model;
    useGpu?: boolean;
    systemPrompt?: string;
    sampler?: SamplerConfig;
    contextSize?: number;
  }) => Promise<void>;
  disposeChat: () => void;
  dispose: () => void;
}

const AiServiceContext = createContext<AiServiceContextValue | undefined>(
  undefined,
);

const _initialState: AiServiceState = {
  chatState: AiModelState.NotLoaded,
  chatPipeline: ModelPipeline.textGeneration,
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

  // Bumped on every dispose. A createChat that resolves after its generation
  // passed must discard its instance instead of resurrecting a disposed chat.
  const chatGeneration = useRef(0);

  // The in-flight chat load (undefined when idle), so the next createChat can
  // serialize behind it. Chat.fromPath has no cancellation, and disposeChat
  // can't tear down a load that hasn't returned its instance yet — so without
  // serializing, switching models mid-load would run two heavy llama.cpp loads
  // at once. That deadlocks (or OOMs) the native backend, and the app then
  // hangs on "Loading…" forever — even across restarts, since the same model
  // stays persisted as in use. Chaining each load onto the previous one
  // guarantees only one fromPath runs at a time, so a superseded load fully
  // releases the backend before the next begins.
  const chatLoadRef = useRef<Promise<unknown> | undefined>(undefined);

  // Run a chat teardown serialized on the same chain as loads, so the next
  // createChat's `await previousLoad` also waits out the teardown + settle
  // delay before allocating a new context. Without this, a dispose (e.g. on
  // backgrounding) followed by a reload (on returning) overlaps the old
  // context's native release with the new one's Metal allocation.
  const enqueueTeardown = useCallback((teardown: () => void) => {
    const previous = chatLoadRef.current;
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
    chatLoadRef.current = barrier.catch(() => undefined);
    return barrier;
  }, []);

  const createChat = useCallback(
    async (opts: {
      model: Model;
      useGpu?: boolean;
      systemPrompt?: string;
      sampler?: SamplerConfig;
      contextSize?: number;
    }) => {
      if (chatRef.current) {
        return;
      }

      const generation = chatGeneration.current;
      const previousLoad = chatLoadRef.current;

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
          ? downloadedPartPath(chatPart.fileName)
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
          ? (downloadedPartPath(projectionPart.fileName) ?? undefined)
          : undefined;

        if (projectionPart && !projectionModelPath) {
          throw new Error(
            `AiService: projection-model file missing for model ${model.id} (${model.name}) — re-download required`,
          );
        }

        const tools =
          model.toolCalling && model.pipeline === ModelPipeline.textGeneration
            ? buildChatTools()
            : undefined;

        const contextSize =
          opts?.contextSize ??
          (projectionModelPath !== undefined
            ? MULTIMODAL_CONTEXT_SIZE
            : undefined);

        const chat = await Chat.fromPath({
          modelPath: chatModelPath,
          projectionModelPath,
          useGpu: opts?.useGpu ?? true,
          tools: tools,
          systemPrompt: opts?.systemPrompt,
          sampler: opts?.sampler,
          contextSize,
          templateVariables: { enable_thinking: model.thinking },
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
          // This IIFE owns chatLoadRef, so we can't enqueueTeardown (self-wait).
          // The newer load already awaits this IIFE via `await previousLoad`, so
          // settling here delays its fromPath until our GPU buffers are freed.
          await sleep(TEARDOWN_SETTLE_MS);
          return;
        }

        chatRef.current = chat;
        setState(s => ({
          ...s,
          chatState: AiModelState.Ready,
          chatPipeline: toChatPipeline(model.pipeline),
        }));
      })();

      // Publish this load so the next createChat serializes behind it. The
      // stored handle swallows rejections so one failed load can't reject the
      // next load's `await previousLoad`.
      chatLoadRef.current = load.catch(() => undefined);

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

  const dispose = useCallback(() => {
    chatGeneration.current += 1;
    // Clear the ref BEFORE destroying so a throwing destroy() can't leave a
    // stale instance that blocks the next createChat().
    const chatInstance = chatRef.current;
    chatRef.current = undefined;

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

    setState(_initialState);
  }, [enqueueTeardown]);

  const value = useMemo<AiServiceContextValue>(
    () => ({
      ...state,
      chat: chatRef,
      createChat,
      disposeChat,
      dispose,
    }),
    [state, createChat, disposeChat, dispose],
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
