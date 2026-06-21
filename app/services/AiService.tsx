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
  Encoder,
  CrossEncoder,
  Tool,
  SamplerConfig,
} from 'react-native-nobodywho';
import * as Sentry from '@sentry/react-native';
import { log, getAssetPath } from 'helpers';
import { ChatPipeline, Model, ModelPipeline, toChatPipeline } from 'types';

export enum AiModelState {
  NotLoaded = 'notLoaded',
  Loading = 'loading',
  Ready = 'ready',
  Error = 'error',
}

enum ModelName {
  Embedding = 'embedding-model.gguf',
  Reranker = 'reranker-model.gguf',
}

interface AiServiceState {
  chatState: AiModelState;
  chatPipeline: ChatPipeline;
  encoderState: AiModelState;
  crossEncoderState: AiModelState;
}

interface AiServiceContextValue extends AiServiceState {
  chat: React.RefObject<Chat | undefined>;
  encoder: React.RefObject<Encoder | undefined>;
  crossEncoder: React.RefObject<CrossEncoder | undefined>;

  createChat: (opts: {
    model: Model;
    useGpu?: boolean;
    tools?: Tool[];
    systemPrompt?: string;
    sampler?: SamplerConfig;
    contextSize?: number;
  }) => Promise<void>;
  createEncoder: (opts?: {
    useGpu?: boolean;
    contextSize?: number;
  }) => Promise<void>;
  createCrossEncoder: (opts?: {
    useGpu?: boolean;
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
  encoderState: AiModelState.NotLoaded,
  crossEncoderState: AiModelState.NotLoaded,
};

export const AiServiceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AiServiceState>(_initialState);

  // Guard to prevent duplicate loading of the embedding/reranker models — e.g.
  // if createEncoder is called twice quickly. Chat loads are serialized through
  // chatLoadRef instead (see createChat).
  const inFlight = useRef({
    encoder: false,
    crossEncoder: false,
  });

  const chatRef = useRef<Chat | undefined>(undefined);
  const encoderRef = useRef<Encoder | undefined>(undefined);
  const crossEncoderRef = useRef<CrossEncoder | undefined>(undefined);

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

  const createChat = useCallback(
    async (opts: {
      model: Model;
      useGpu?: boolean;
      tools?: Tool[];
      systemPrompt?: string;
      sampler?: SamplerConfig;
      contextSize?: number;
    }) => {
      if (chatRef.current) return;

      const generation = chatGeneration.current;
      const previousLoad = chatLoadRef.current;

      const load = (async () => {
        // Wait for any in-flight load to fully settle (and release the native
        // backend) before touching it again. When idle there's nothing to wait
        // for, so the first load reaches fromPath in the same tick.
        if (previousLoad) await previousLoad;

        // A dispose or a newer load superseded us while we waited — bail before
        // starting an unwanted load. A sibling load of the same model that
        // already produced a chat is reused rather than loaded a second time.
        if (generation !== chatGeneration.current || chatRef.current) return;

        setState(s => ({ ...s, chatState: AiModelState.Loading }));

        const { model } = opts;

        const chatModelPath = model.parts.find(
          part => part.type === 'chat-model',
        )?.url as string;

        const projectionModelPath =
          model.pipeline !== ModelPipeline.textGeneration
            ? model.parts.find(part => part.type === 'projection-model')?.url
            : undefined;

        // if (__DEV__) {
        //   chatModelPath = await getAssetPath(`${model.name}.gguf`);
        // }

        const chat = await Chat.fromPath({
          modelPath: chatModelPath,
          projectionModelPath,
          useGpu: opts?.useGpu ?? true,
          tools: opts?.tools ?? [],
          systemPrompt: opts?.systemPrompt,
          sampler: opts?.sampler,
          contextSize: opts?.contextSize,
        });

        if (generation !== chatGeneration.current) {
          // Disposed while loading; a newer chat may already be in flight.
          chat.destroy();
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

  // Embeddings
  const createEncoder = useCallback(
    async (opts?: { useGpu?: boolean; contextSize?: number }) => {
      if (inFlight.current.encoder || encoderRef.current) return;
      inFlight.current.encoder = true;
      setState(s => ({ ...s, encoderState: AiModelState.Loading }));
      try {
        const modelPath = await getAssetPath(ModelName.Embedding);
        const encoder = await Encoder.fromPath({
          modelPath,
          useGpu: opts?.useGpu ?? true,
          contextSize: opts?.contextSize,
        });
        encoderRef.current = encoder;
        setState(s => ({ ...s, encoderState: AiModelState.Ready }));
      } catch (error) {
        log('AiService createEncoder', error, { capture: true });
        setState(s => ({ ...s, encoderState: AiModelState.Error }));
      } finally {
        inFlight.current.encoder = false;
      }
    },
    [],
  );

  // ReRanker
  const createCrossEncoder = useCallback(
    async (opts?: { useGpu?: boolean; contextSize?: number }) => {
      if (inFlight.current.crossEncoder || crossEncoderRef.current) return;
      inFlight.current.crossEncoder = true;
      setState(s => ({ ...s, crossEncoderState: AiModelState.Loading }));
      try {
        const modelPath = await getAssetPath(ModelName.Reranker);
        const crossEncoder = await CrossEncoder.fromPath({
          modelPath,
          useGpu: opts?.useGpu ?? true,
          contextSize: opts?.contextSize,
        });
        crossEncoderRef.current = crossEncoder;
        setState(s => ({ ...s, crossEncoderState: AiModelState.Ready }));
      } catch (error) {
        log('AiService createCrossEncoder', error, { capture: true });
        setState(s => ({ ...s, crossEncoderState: AiModelState.Error }));
      } finally {
        inFlight.current.crossEncoder = false;
      }
    },
    [],
  );

  const disposeChat = useCallback(() => {
    chatGeneration.current += 1;
    const instance = chatRef.current;
    chatRef.current = undefined;

    try {
      // Stop any in-flight generation before freeing the context, so a stream
      // still being consumed (e.g. ChatScreen mid-send during a model switch)
      // ends cleanly instead of the native context being torn out under it.
      instance?.stopGeneration();
    } catch (error) {
      log('AiService disposeChat stopGeneration failed', error, {
        capture: true,
      });
    }
    try {
      instance?.destroy();
    } catch (error) {
      log('AiService disposeChat destroy failed', error);
    }

    setState(s => ({
      ...s,
      chatState: AiModelState.NotLoaded,
      chatPipeline: ModelPipeline.textGeneration,
    }));
  }, []);

  const dispose = useCallback(() => {
    chatGeneration.current += 1;
    // Clear refs BEFORE destroying so a throwing destroy() can't leave a stale
    // instance that blocks the next createX(); destroy each independently so one
    // failure doesn't skip the others.
    const chatInstance = chatRef.current;
    const instances = [
      chatInstance,
      encoderRef.current,
      crossEncoderRef.current,
    ];
    chatRef.current = undefined;
    encoderRef.current = undefined;
    crossEncoderRef.current = undefined;

    // Reset in-flight flags so a subsequent createX() isn't silently skipped
    // if dispose ran while a load was pending. (Chat serializes via chatLoadRef
    // and needs no flag — a pending chat load settles and self-discards via the
    // bumped generation above.)
    inFlight.current.encoder = false;
    inFlight.current.crossEncoder = false;

    // Only Chat streams, so stop its generation before freeing the context.
    try {
      chatInstance?.stopGeneration();
    } catch (error) {
      log('AiService dispose stopGeneration failed', error, { capture: true });
    }
    for (const instance of instances) {
      try {
        instance?.destroy();
      } catch (error) {
        log('AiService dispose destroy failed', error, { capture: true });
      }
    }

    setState(_initialState);
  }, []);

  const value = useMemo<AiServiceContextValue>(
    () => ({
      ...state,
      chat: chatRef,
      encoder: encoderRef,
      crossEncoder: crossEncoderRef,
      createChat,
      createEncoder,
      createCrossEncoder,
      disposeChat,
      dispose,
    }),
    [
      state,
      createChat,
      createEncoder,
      createCrossEncoder,
      disposeChat,
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
