export interface ModelPart {
  url: string;
  fileName: string; // Path of the file relative to the model's root directory, may contain subdirectories (e.g. "onnx/vocoder.onnx")
  type: string; // values: chat-model | projection-model | tts-file...
  path: string;
  sizeGB: number;
}

export interface Model {
  id: number;
  name: string;
  sizeGB: number;
  parameterCountBillions: number;
  author: string;
  family: string;
  thinking: boolean;
  toolCalling: boolean;
  huggingfaceUrl: string;
  parts: ModelPart[];
  pipeline: ModelPipeline;
  tags: string[];
  languages: string[];
  supportedFileFormat: string[];
}

// A model part plus how far its download has got — everything needed to compute
// overall progress from the database alone, weighted by each part's size.
export interface ModelDownloadPart extends ModelPart {
  // Download progress for this part, as a fraction between 0 and 1.
  progress: number;
}

export interface ModelDownload {
  // Snapshot of the model being downloaded, so it can be rendered before it
  // exists in the `models` table.
  model: Model;
  // Per-part download progress; the source of truth for the overall progress.
  partsProgress: ModelDownloadPart[];
}

export enum ModelPipeline {
  textGeneration = "textGeneration",
  imageToImage = "imageToImage",
  imageTextToText = "imageTextToText",
  audioTextToText = "audioTextToText",
  imageAudioTextToText = "imageAudioTextToText",
  featureExtraction = "featureExtraction",
  textRanking = "textRanking",
  textToSpeech = "textToSpeech",
  speechToText = "speechToText",
  voiceActivityDetection = "voiceActivityDetection"
}

export const pipelineLabel: Record<ModelPipeline, string> = {
  [ModelPipeline.textGeneration]: 'Text generation',
  [ModelPipeline.imageToImage]: 'Image to Image',
  [ModelPipeline.imageTextToText]: 'Image/Text to Text',
  [ModelPipeline.audioTextToText]: 'Audio/Text to Text',
  [ModelPipeline.imageAudioTextToText]: 'Image/Audio/Text to Text',
  [ModelPipeline.featureExtraction]: 'Feature extraction',
  [ModelPipeline.textRanking]: 'Text ranking',
  [ModelPipeline.textToSpeech]: 'Text to Speech',
  [ModelPipeline.speechToText]: 'Speech to Text',
  [ModelPipeline.voiceActivityDetection]: 'Voice Activity Detection',
};

export type ChatPipeline =
  | ModelPipeline.textGeneration
  | ModelPipeline.imageTextToText
  | ModelPipeline.audioTextToText
  | ModelPipeline.imageAudioTextToText;

export const isChatPipeline = (
  pipeline: ModelPipeline,
): pipeline is ChatPipeline =>
  pipeline === ModelPipeline.textGeneration ||
  pipeline === ModelPipeline.imageTextToText ||
  pipeline === ModelPipeline.audioTextToText ||
  pipeline === ModelPipeline.imageAudioTextToText;

export const isTtsPipeline = (pipeline: ModelPipeline): boolean =>
  pipeline === ModelPipeline.textToSpeech;

export const isSttPipeline = (pipeline: ModelPipeline): boolean =>
  pipeline === ModelPipeline.speechToText;

// Only chat-capable pipelines may reach the chat backend; a non-chat model
// (e.g. text-to-speech or speech-to-text) slipping through would be silently
// loaded as a GGUF chat model and fail deep in the native layer — throw at the
// boundary instead.
export const toChatPipeline = (pipeline: ModelPipeline): ChatPipeline => {
  if (isChatPipeline(pipeline)) {
    return pipeline;
  }
  if (isTtsPipeline(pipeline) || isSttPipeline(pipeline)) {
    throw new Error(`toChatPipeline: ${pipeline} is not a chat pipeline`);
  }
  return ModelPipeline.textGeneration;
};

export const pipelineIngestsImage = (pipeline: ChatPipeline): boolean =>
  pipeline === ModelPipeline.imageTextToText ||
  pipeline === ModelPipeline.imageAudioTextToText;

export const pipelineIngestsAudio = (pipeline: ChatPipeline): boolean =>
  pipeline === ModelPipeline.audioTextToText ||
  pipeline === ModelPipeline.imageAudioTextToText;
