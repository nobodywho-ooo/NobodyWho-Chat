import {
  Chat,
  Model as NobodyWhoModel,
  SamplerConfig,
  SpeechToText,
  TextToSpeech,
  VoiceActivityDetection,
} from 'react-native-nobodywho';
import {
  downloadedPartPath,
  implicitThinkOpen,
  log,
  modelDirectoryPath,
  multimodalContextSize,
  resolveSttQuantization,
  ttsEngineForModel,
} from 'helpers';
import { Model, ModelPipeline, ModelSlot, toChatPipeline } from 'types';

import { buildChatTools } from '../tools';
import { EngineSpec } from './nativeSlot';
import {
  VAD_MIN_SILENCE_MS,
  VAD_MIN_SPEECH_MS,
  VAD_SAMPLE_RATE,
  VAD_THRESHOLD,
  clampContextSize,
} from './tuning';

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

export type VadOptions = Record<never, never>;

const missingPart = (model: Model, type: string) =>
  new Error(
    `AiService: ${type} file missing for model ${model.id} (${model.name}) — re-download required`,
  );

// Where a part of `type` was downloaded to. Undefined when the model declares no
// such part, but a failure when it declares one that isn't on disk.
const optionalPartPath = (model: Model, type: string): string | undefined => {
  const part = model.parts.find(candidate => candidate.type === type);

  if (!part) {
    return undefined;
  }

  const path = downloadedPartPath(model.id, part.fileName);

  if (!path) {
    throw missingPart(model, type);
  }

  return path;
};

// As above, for a part the engine cannot load without.
const requiredPartPath = (model: Model, type: string): string => {
  const path = optionalPartPath(model, type);

  if (!path) {
    throw missingPart(model, type);
  }

  return path;
};

// The folder-based loaders (TTS, STT, VAD) are pointed at the model's directory
// rather than at named files, so every declared part has to be on disk first.
const modelDirectoryWithAllParts = (model: Model): string => {
  const missing = model.parts.find(
    part => downloadedPartPath(model.id, part.fileName) === null,
  );

  if (missing) {
    throw new Error(
      `AiService: file ${missing.fileName} missing for model ${model.id} (${model.name}) — re-download required`,
    );
  }

  return modelDirectoryPath(model.id);
};

export const CHAT_ENGINE: EngineSpec<Chat, ChatOptions> = {
  slot: ModelSlot.chat,
  cleared: {
    chatPipeline: ModelPipeline.textGeneration,
    chatThinkOpen: undefined,
  },
  stop: instance => instance.stopGeneration(),
  open: async (model, opts) => {
    const modelPath = requiredPartPath(model, 'chat-model');

    const projectionModelPath =
      model.pipeline === ModelPipeline.textGeneration
        ? undefined
        : optionalPartPath(model, 'projection-model');

    const loaded = await NobodyWhoModel.load({
      modelPath,
      projectionModelPath,
      useGpu: opts.useGpu ?? true,
    });

    const trainedForContext =
      Number.isFinite(loaded.maxCtx) && loaded.maxCtx > 0
        ? loaded.maxCtx
        : undefined;

    const multimodalCap = projectionModelPath
      ? await multimodalContextSize(model)
      : undefined;

    const requestedContext =
      multimodalCap === undefined
        ? opts.contextSize
        : Math.min(opts.contextSize ?? multimodalCap, multimodalCap);

    const contextSize = clampContextSize(requestedContext, trainedForContext);

    if (requestedContext !== undefined && contextSize !== requestedContext) {
      log(
        `AiService chat: context ${requestedContext} exceeds what model ${model.id} (${model.name}) was trained for — using ${contextSize}`,
      );
    }

    const enableThinking = model.thinking && (opts.thinking ?? true);

    const useTools =
      model.toolCalling &&
      (opts.toolCalling ?? true) &&
      model.pipeline === ModelPipeline.textGeneration;

    const instance = new Chat({
      model: loaded,
      tools: useTools ? buildChatTools() : undefined,
      systemPrompt: opts.systemPrompt,
      sampler: opts.sampler,
      contextSize,
      templateVariables: { enable_thinking: enableThinking },
    });

    return {
      instance,
      state: {
        chatPipeline: toChatPipeline(model.pipeline),
        chatThinkOpen: implicitThinkOpen(model, enableThinking),
      },
    };
  },
};

export const TTS_ENGINE: EngineSpec<TextToSpeech, TtsOptions> = {
  slot: ModelSlot.tts,
  cleared: { ttsArchitecture: undefined },

  open: async (model, opts) => {
    const source = modelDirectoryWithAllParts(model);
    const engine = ttsEngineForModel(model);

    if (!engine) {
      throw new Error(
        `AiService: unsupported TTS engine for model ${model.id} (${model.name}, family "${model.family}")`,
      );
    }

    const instance = await TextToSpeech.load({
      source,
      architecture: engine.architecture,
      voice: opts.voice,
      language: opts.language,
    });

    return { instance, state: { ttsArchitecture: engine.architecture } };
  },
};

export const STT_ENGINE: EngineSpec<SpeechToText, SttOptions> = {
  slot: ModelSlot.stt,

  open: async (model, opts) => ({
    instance: await SpeechToText.load({
      source: modelDirectoryWithAllParts(model),
      language: opts.language,
      quantization: resolveSttQuantization(model),
    }),
  }),
};

export const VAD_ENGINE: EngineSpec<VoiceActivityDetection, VadOptions> = {
  slot: ModelSlot.vad,

  open: async model => ({
    instance: await VoiceActivityDetection.load({
      source: modelDirectoryWithAllParts(model),
      sampleRate: VAD_SAMPLE_RATE,
      threshold: VAD_THRESHOLD,
      minSpeechDurationMs: VAD_MIN_SPEECH_MS,
      minSilenceDurationMs: VAD_MIN_SILENCE_MS,
    }),
  }),
};
