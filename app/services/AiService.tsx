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
  SpeechToText,
  TextToSpeech,
  TextToSpeechArchitecture,
  VoiceActivityDetection,
} from 'react-native-nobodywho';
import * as Sentry from '@sentry/react-native';
import {
  downloadedPartPath,
  log,
  modelDirectoryPath,
  resolveSttQuantization,
  sleep,
  ttsEngineForModel,
} from 'helpers';
import {
  ChatPipeline,
  Model,
  ModelPipeline,
  isChatPipeline,
  isSttPipeline,
  isTtsPipeline,
  isVadPipeline,
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
  ttsArchitecture?: TextToSpeechArchitecture;
  sttState: AiModelState;
  vadState: AiModelState;
}

export interface ChatOptions {
  useGpu?: boolean;
  systemPrompt?: string;
  sampler?: SamplerConfig;
  contextSize?: number;
  thinking?: boolean;
  toolCalling?: boolean;
}

export interface TtsOptions {
  voice?: string;
  language?: string;
}

export interface SttOptions {
  language?: string;
}

// VAD takes no per-load options: its sample rate and silence threshold are
// module constants every caller has to feed it at anyway.
export type VadOptions = Record<never, never>;

interface AiServiceContextValue extends AiServiceState {
  chat: React.RefObject<Chat | undefined>;
  tts: React.RefObject<TextToSpeech | undefined>;
  stt: React.RefObject<SpeechToText | undefined>;
  vad: React.RefObject<VoiceActivityDetection | undefined>;

  createChat: (opts: ChatOptions & { model: Model }) => Promise<void>;
  disposeChat: () => void;
  createTts: (opts: TtsOptions & { model: Model }) => Promise<void>;
  disposeTts: () => void;
  createStt: (opts: SttOptions & { model: Model }) => Promise<void>;
  disposeStt: () => void;
  createVad: (opts: VadOptions & { model: Model }) => Promise<void>;
  disposeVad: () => void;

  // Run work against a loaded engine while holding it open, so a dispose racing
  // it waits instead of freeing the handle mid-call. Resolve to undefined when
  // the slot isn't loaded. Neither engine can be cancelled once started, so any
  // await against them belongs inside one of these.
  borrowTts: <R>(
    work: (instance: TextToSpeech) => Promise<R>,
  ) => Promise<R | undefined>;
  borrowStt: <R>(
    work: (instance: SpeechToText) => Promise<R>,
  ) => Promise<R | undefined>;

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
  vadState: AiModelState.NotLoaded,
};

// destroy() is fire-and-forget: it signals the native worker thread but returns
// before the llama_context / Metal buffers are actually freed, with no
// completion signal to await. So after a teardown we yield the event loop and
// wait this long before the next load allocates — otherwise the new context
// starts reserving Metal buffers while the old one is still releasing them,
// which on multimodal models (large footprint) makes a buffer allocation return
// NULL and crashes inside ggml-metal. Heuristic, not a real wait; bump it if
// field crashes persist.
export const TEARDOWN_SETTLE_MS = 500;

export const MULTIMODAL_CONTEXT_SIZE = 2048;

// The rate the voice activity detector is told its input is in. Silero runs at
// 16 kHz internally and the rate is fixed at load time, so every caller has to
// feed it audio at exactly this rate (see resamplePcm) rather than whatever the
// microphone happens to deliver — audio pushed at the wrong rate is played back
// to the model time-stretched, which wrecks both detection and the durations
// the silence/speech thresholds are expressed in.
export const VAD_SAMPLE_RATE = 16000;

// How long the user has to stay quiet before the detector calls the turn over.
// The engine's own default (250 ms) fires while someone is still mid-sentence,
// just thinking; ~0.7 s is the usual compromise between cutting people off and
// making them wait. Everything else (threshold, minimum speech, pre-roll) keeps
// the engine's defaults.
export const VAD_MIN_SILENCE_MS = 700;

type SlotStateKey = 'chatState' | 'ttsState' | 'sttState' | 'vadState';

interface NativeInstance {
  destroy: () => void;
}

interface SlotSpec<TInstance extends NativeInstance, TOptions> {
  stateKey: SlotStateKey;
  accepts: (pipeline: ModelPipeline) => boolean;
  open: (
    model: Model,
    opts: TOptions,
  ) => Promise<{ instance: TInstance; state?: Partial<AiServiceState> }>;
  // Extra state reset alongside `<stateKey>: NotLoaded` on dispose.
  cleared?: Partial<AiServiceState>;
  // Interrupt in-flight work before destroy(). Only Chat can be interrupted;
  // TTS/STT/VAD expose no cancel at all, which is what borrow() is for.
  stop?: (instance: TInstance) => void;
}

interface NativeSlot<TInstance extends NativeInstance, TOptions> {
  ref: React.RefObject<TInstance | undefined>;
  create: (opts: TOptions & { model: Model }) => Promise<void>;
  dispose: () => void;
  borrow: <R>(
    work: (instance: TInstance) => Promise<R>,
  ) => Promise<R | undefined>;
}

// Names the slot in error messages and logs ("chat", "tts", …)
const slotLabel = (stateKey: SlotStateKey): string =>
  stateKey.replace('State', '');

// A computed key over a union of literals widens to a string index signature,
// which no longer matches AiServiceState — assert the narrow shape back.
const slotPatch = (
  stateKey: SlotStateKey,
  next: AiModelState,
): Partial<AiServiceState> => ({ [stateKey]: next }) as Partial<AiServiceState>;

// Every declared part must be on disk before the folder-based loaders (TTS,
// STT, VAD) are pointed at the model's directory — a missing weight otherwise
// surfaces deep inside the engine as an opaque load failure.
const requireAllParts = (model: Model): void => {
  const missing = model.parts.find(
    part => downloadedPartPath(model.id, part.fileName) === null,
  );

  if (missing) {
    throw new Error(
      `AiService: file ${missing.fileName} missing for model ${model.id} (${model.name}) — re-download required`,
    );
  }
};

// One native model slot: the load-serialization protocol every engine shares,
// written once instead of copied per engine.
//
// Native loads must never overlap each other, and a teardown must never overlap
// a load: either one deadlocks the worker (an endless "Loading…") or frees GPU
// buffers under a live allocation (EXC_BAD_ACCESS inside ggml-metal). Every
// slot therefore chains onto the single shared `nativeLoadRef` promise, and a
// per-slot generation counter lets a load that was superseded while it waited
// throw its instance away instead of resurrecting a disposed engine.
const useNativeSlot = <TInstance extends NativeInstance, TOptions>(
  spec: SlotSpec<TInstance, TOptions>,
  setState: React.Dispatch<React.SetStateAction<AiServiceState>>,
  nativeLoadRef: React.RefObject<Promise<unknown> | undefined>,
  enqueueTeardown: (teardown: () => Promise<void>) => Promise<void>,
): NativeSlot<TInstance, TOptions> => {
  const ref = useRef<TInstance | undefined>(undefined);
  // Which model `ref` actually holds. Without it, "is the ref set" is the only
  // reuse test, and two loads racing for different models leave the slot
  // serving one while app state points at the other, permanently.
  const loadedModelId = useRef<number | undefined>(undefined);
  // Bumped on every dispose. A load that resolves after its generation passed
  // must discard its instance rather than resurrect a disposed engine.
  const generation = useRef(0);
  // Work borrowed against the live instance. A teardown waits for it: none of
  // these engines can be interrupted, so destroying under a running call frees
  // the handle from under Rust.
  const inFlight = useRef(new Set<Promise<unknown>>());

  // The spec closes over fresh callbacks every render; hold it in a ref so the
  // functions returned below stay referentially stable for the context memo.
  const specRef = useRef(spec);
  specRef.current = spec;

  const settleInFlight = useCallback(async () => {
    // A borrow started while we waited has to finish too. The set stops growing
    // once the caller has cleared `ref`, after which borrow() hands nothing out.
    while (inFlight.current.size > 0) {
      await Promise.all([...inFlight.current]);
    }
  }, []);

  // Free a handle we own the load chain for. Does not settle afterwards — the
  // caller decides, because a teardown burst only needs to settle once.
  const destroyInstance = useCallback(
    async (instance: TInstance) => {
      const { stateKey, stop } = specRef.current;
      const label = slotLabel(stateKey);

      await settleInFlight();

      try {
        stop?.(instance);
      } catch (error) {
        log(`AiService ${label} stop failed`, error, { capture: true });
      }

      try {
        instance.destroy();
      } catch (error) {
        log(`AiService ${label} destroy failed`, error, { capture: true });
      }
    },
    [settleInFlight],
  );

  const create = useCallback(
    async (opts: TOptions & { model: Model }) => {
      const { accepts, stateKey } = specRef.current;
      const label = slotLabel(stateKey);
      const { model } = opts;

      // Already serving exactly this model — nothing to do.
      if (ref.current && loadedModelId.current === model.id) {
        return;
      }

      if (!accepts(model.pipeline)) {
        throw new Error(
          `AiService: model ${model.id} (${model.name}) is not a valid ${label} model`,
        );
      }

      const generationAtCall = generation.current;
      const previousLoad = nativeLoadRef.current;

      const load = async () => {
        // Wait for any in-flight load to fully settle (and release the native
        // backend) before touching it again. When idle there is nothing to wait
        // for, so the first load reaches the loader in the same tick.
        if (previousLoad) {
          await previousLoad;
        }

        // Disposed while we waited — bail before starting an unwanted load.
        if (generationAtCall !== generation.current) {
          return;
        }

        const stale = ref.current;

        if (stale) {
          // A sibling load got there first. Same model: reuse it. Different
          // model: our caller's selection is the newer one, so replace it —
          // leaving the old instance in place would make the slot's id and the
          // live engine disagree with no way back. Safe to free here: this
          // function owns the load chain for its whole body.
          if (loadedModelId.current === model.id) {
            return;
          }

          ref.current = undefined;
          loadedModelId.current = undefined;
          await destroyInstance(stale);
          await sleep(TEARDOWN_SETTLE_MS);
        }

        setState(s => ({ ...s, ...slotPatch(stateKey, AiModelState.Loading) }));

        const { instance, state } = await specRef.current.open(model, opts);

        if (generationAtCall !== generation.current) {
          // Disposed while loading; a newer load may already be in flight. This
          // function owns nativeLoadRef, so it can't enqueueTeardown (it would
          // wait on itself). The newer load awaits us through `previousLoad`,
          // so settling here delays its loader until our buffers are freed.
          await destroyInstance(instance);
          await sleep(TEARDOWN_SETTLE_MS);
          return;
        }

        ref.current = instance;
        loadedModelId.current = model.id;
        setState(s => ({
          ...s,
          ...slotPatch(stateKey, AiModelState.Ready),
          ...state,
        }));
      };

      // Invoke the load exactly once and publish that single promise, so the
      // next create (or teardown) serializes behind it. Calling load() a second
      // time here would run two native loads at once — the concurrent-load
      // deadlock this whole chain exists to prevent. The stored handle swallows
      // rejections so one failed load can't reject the next `previousLoad`.
      const loadPromise = load();
      nativeLoadRef.current = loadPromise.catch(() => undefined);

      try {
        await loadPromise;
      } catch (error) {
        log(`AiService create ${label}`, error, { capture: true });
        // Only the generation that still owns the slot may surface the error; a
        // superseded load must not flip a newer load's state to Error.
        if (generationAtCall === generation.current) {
          setState(s => ({ ...s, ...slotPatch(stateKey, AiModelState.Error) }));
        }
        throw error;
      }
    },
    [destroyInstance, nativeLoadRef, setState],
  );

  const dispose = useCallback(() => {
    const { stateKey, cleared } = specRef.current;

    generation.current += 1;
    const instance = ref.current;
    // Cleared before the teardown runs, so a throwing destroy() can't leave a
    // stale instance blocking the next create, and so borrow() stops handing
    // the handle out while we are freeing it.
    ref.current = undefined;
    loadedModelId.current = undefined;

    if (instance) {
      enqueueTeardown(() => destroyInstance(instance));
    }

    setState(s => ({
      ...s,
      ...slotPatch(stateKey, AiModelState.NotLoaded),
      ...cleared,
    }));
  }, [destroyInstance, enqueueTeardown, setState]);

  const borrow = useCallback(
    async <R,>(
      work: (instance: TInstance) => Promise<R>,
    ): Promise<R | undefined> => {
      const instance = ref.current;

      if (!instance) {
        return undefined;
      }

      const running = work(instance);
      // Tracked separately so a rejection here can't reject a teardown's wait —
      // the borrower still sees the original rejection below.
      const tracked = running.catch(() => undefined);
      inFlight.current.add(tracked);

      try {
        return await running;
      } finally {
        inFlight.current.delete(tracked);
      }
    },
    [],
  );

  return useMemo(
    () => ({ ref, create, dispose, borrow }),
    [borrow, create, dispose],
  );
};

export const AiServiceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AiServiceState>(_initialState);

  const nativeLoadRef = useRef<Promise<unknown> | undefined>(undefined);
  // How many teardowns are still queued on the chain. Only the last one in a
  // burst pays the settle: it exists to keep the *next load* off the backend
  // while buffers are freed, and back-to-back destroys allocate nothing. Without
  // this, disposing all four slots (backgrounding) sleeps 4 × TEARDOWN_SETTLE_MS
  // in series, all of which the next load has to wait out on resume.
  const pendingTeardowns = useRef(0);

  // Run a teardown serialized on the same chain as loads, so the next create's
  // `await previousLoad` also waits out the teardown and its settle before
  // allocating. Without this, a dispose (on backgrounding) followed by a reload
  // (on returning) overlaps the old context's native release with the new one's
  // Metal allocation.
  const enqueueTeardown = useCallback((teardown: () => Promise<void>) => {
    const previous = nativeLoadRef.current;
    pendingTeardowns.current += 1;

    const barrier = (async () => {
      // Serialize behind any in-flight load before touching the backend.
      if (previous) {
        await previous;
      }

      try {
        await teardown();
      } catch (error) {
        log('AiService teardown failed', error, { capture: true });
      } finally {
        pendingTeardowns.current -= 1;
      }

      if (pendingTeardowns.current === 0) {
        await sleep(TEARDOWN_SETTLE_MS);
      }
    })();

    // Publish so the next create (or teardown) serializes behind us; swallow
    // rejections so one failure can't reject the next `await previousLoad`.
    nativeLoadRef.current = barrier.catch(() => undefined);
    return barrier;
  }, []);

  const chatSlot = useNativeSlot<Chat, ChatOptions>(
    {
      stateKey: 'chatState',
      accepts: isChatPipeline,
      cleared: { chatPipeline: ModelPipeline.textGeneration },
      // Stop any in-flight generation before freeing the context, so a stream
      // still being consumed (e.g. ChatScreen mid-send during a model switch)
      // ends cleanly instead of having the context torn out from under it.
      stop: instance => instance.stopGeneration(),
      open: async (model, opts) => {
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

        // Multimodal contexts are capped: larger ones exhaust Metal buffers.
        const contextSize =
          projectionModelPath !== undefined
            ? Math.min(
                opts.contextSize ?? MULTIMODAL_CONTEXT_SIZE,
                MULTIMODAL_CONTEXT_SIZE,
              )
            : opts.contextSize;

        const instance = await Chat.fromPath({
          modelPath: chatModelPath,
          projectionModelPath,
          useGpu: opts.useGpu ?? true,
          tools,
          systemPrompt: opts.systemPrompt,
          sampler: opts.sampler,
          contextSize,
          templateVariables: {
            enable_thinking: model.thinking && (opts.thinking ?? true),
          },
        });

        return {
          instance,
          state: { chatPipeline: toChatPipeline(model.pipeline) },
        };
      },
    },
    setState,
    nativeLoadRef,
    enqueueTeardown,
  );

  const ttsSlot = useNativeSlot<TextToSpeech, TtsOptions>(
    {
      stateKey: 'ttsState',
      accepts: isTtsPipeline,
      cleared: { ttsArchitecture: undefined },
      open: async (model, opts) => {
        requireAllParts(model);

        // Downloaded models live in id-named dirs (…/models/7), so the
        // architecture can't be inferred from the path — resolve it from the
        // catalogue family through the engine registry, which fails here with a
        // real message rather than handing the loader an unknown string.
        const engine = ttsEngineForModel(model);

        if (!engine) {
          throw new Error(
            `AiService: unsupported TTS engine for model ${model.id} (${model.name}, family "${model.family}")`,
          );
        }

        const instance = await TextToSpeech.load({
          source: modelDirectoryPath(model.id),
          architecture: engine.architecture,
          // Load-time options, already resolved against this engine's own
          // vocabulary by resolveTtsPrefs. An omitted key keeps the engine's
          // built-in default, which is what an option it offers nothing for
          // (pocket-tts voices) arrives here as.
          voice: opts.voice,
          language: opts.language,
        });

        return { instance, state: { ttsArchitecture: engine.architecture } };
      },
    },
    setState,
    nativeLoadRef,
    enqueueTeardown,
  );

  const sttSlot = useNativeSlot<SpeechToText, SttOptions>(
    {
      stateKey: 'sttState',
      accepts: isSttPipeline,
      open: async (model, opts) => {
        requireAllParts(model);

        // Whisper is loaded from the model's own directory (…/models/<id>), the
        // same folder-based source TTS uses. `language` is optional: when
        // omitted the engine auto-detects the spoken language (passing an ISO
        // 639-1 code skips detection and is faster). `quantization` must match
        // the ONNX variant that was downloaded (e.g. "int8"), otherwise the
        // loader looks for the engine's default unsuffixed weights, which the
        // model doesn't ship, and fails to load.
        const instance = await SpeechToText.load({
          source: modelDirectoryPath(model.id),
          language: opts.language,
          quantization: resolveSttQuantization(model),
        });

        return { instance };
      },
    },
    setState,
    nativeLoadRef,
    enqueueTeardown,
  );

  // Voice activity detection: a tiny Silero ONNX model that tells speech and
  // silence apart, so a recording can end itself when the user stops talking
  // instead of waiting for a tap. The voice assistant is built on it — that
  // screen stays unavailable until one is loaded — while the input bar's
  // dictation only uses it when there is one, and falls back to a manual stop.
  const vadSlot = useNativeSlot<VoiceActivityDetection, VadOptions>(
    {
      stateKey: 'vadState',
      accepts: isVadPipeline,
      open: async model => {
        requireAllParts(model);

        // Loaded from the model's own directory (…/models/<id>), the same
        // folder-based source TTS and STT use — the loader resolves the Silero
        // weights inside it (onnx/model.onnx, or model.onnx at the root).
        const instance = await VoiceActivityDetection.load({
          source: modelDirectoryPath(model.id),
          sampleRate: VAD_SAMPLE_RATE,
          minSilenceDurationMs: VAD_MIN_SILENCE_MS,
        });

        return { instance };
      },
    },
    setState,
    nativeLoadRef,
    enqueueTeardown,
  );

  const dispose = useCallback(() => {
    // Each slot clears its ref synchronously and enqueues its teardown on the
    // shared chain, so they free in this order and only the last one settles.
    chatSlot.dispose();
    ttsSlot.dispose();
    sttSlot.dispose();
    vadSlot.dispose();
  }, [chatSlot, ttsSlot, sttSlot, vadSlot]);

  const value = useMemo<AiServiceContextValue>(
    () => ({
      ...state,
      chat: chatSlot.ref,
      tts: ttsSlot.ref,
      stt: sttSlot.ref,
      vad: vadSlot.ref,
      createChat: chatSlot.create,
      disposeChat: chatSlot.dispose,
      createTts: ttsSlot.create,
      disposeTts: ttsSlot.dispose,
      createStt: sttSlot.create,
      disposeStt: sttSlot.dispose,
      createVad: vadSlot.create,
      disposeVad: vadSlot.dispose,
      borrowTts: ttsSlot.borrow,
      borrowStt: sttSlot.borrow,
      dispose,
    }),
    [state, chatSlot, ttsSlot, sttSlot, vadSlot, dispose],
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
