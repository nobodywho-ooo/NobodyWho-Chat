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
import { Model, ModelPipeline } from 'types';

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
  encoderState: AiModelState.NotLoaded,
  crossEncoderState: AiModelState.NotLoaded,
};

export const AiServiceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AiServiceState>(_initialState);

  // Guard to prevent duplicate loading of the same model. For e.g if createChat is called twice quickly
  const inFlight = useRef({
    chat: false,
    encoder: false,
    crossEncoder: false,
  });

  const chatRef = useRef<Chat | undefined>(undefined);
  const encoderRef = useRef<Encoder | undefined>(undefined);
  const crossEncoderRef = useRef<CrossEncoder | undefined>(undefined);

  // Bumped on every dispose. A createChat that resolves after its generation
  // passed must discard its instance instead of resurrecting a disposed chat.
  const chatGeneration = useRef(0);

  const createChat = useCallback(
    async (opts: {
      model: Model;
      useGpu?: boolean;
      tools?: Tool[];
      systemPrompt?: string;
      sampler?: SamplerConfig;
      contextSize?: number;
    }) => {
      if (inFlight.current.chat || chatRef.current) return;
      inFlight.current.chat = true;
      const generation = chatGeneration.current;
      setState(s => ({ ...s, chatState: AiModelState.Loading }));
      try {
        const { model } = opts;

        let modelPath: string;
        let projectionModelPath: string | undefined;

        if (__DEV__) {
          modelPath = await getAssetPath(`${model.modelName}.gguf`);
        } else {
          modelPath = model.downloadLinks.find(link => link.type === 'model')
            ?.url as string;

          if (model.pipeline !== ModelPipeline.textGeneration) {
            projectionModelPath = model.downloadLinks.find(
              link => link.type === 'projection',
            )?.url;
          }
        }
        const chat = await Chat.fromPath({
          modelPath,
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
        setState(s => ({ ...s, chatState: AiModelState.Ready }));
      } catch (error) {
        log('AiService error', error, { capture: true });
        setState(s => ({ ...s, chatState: AiModelState.Error }));
        throw error;
      } finally {
        // A dispose during the load already handed the in-flight slot to the
        // next createChat — only the owning generation may release it.
        if (generation === chatGeneration.current) {
          inFlight.current.chat = false;
        }
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
        log('AiService error', error, { capture: true });
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
        log('AiService error', error, { capture: true });
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
    inFlight.current.chat = false;

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

    setState(s => ({ ...s, chatState: AiModelState.NotLoaded }));
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
    // if dispose ran while a load was pending.
    inFlight.current.chat = false;
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
