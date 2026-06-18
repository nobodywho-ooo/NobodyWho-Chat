export interface ModelPart {
  url: string;
  fileName: string;
  type: string; // values: chat-model | projection-model
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
  imageIngestion: boolean;
  audioIngestion: boolean;
  huggingfaceUrl: string;
  parts: ModelPart[];
  pipeline: ModelPipeline;
  tags: string[];
  languages: string[];
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
  textRanking = "textRanking"
}

export const pipelineLabel: Record<ModelPipeline, string> = {
  [ModelPipeline.textGeneration]: 'Text generation',
  [ModelPipeline.imageToImage]: 'Image to Image',
  [ModelPipeline.imageTextToText]: 'Image/Text to Text',
  [ModelPipeline.audioTextToText]: 'Audio/Text to Text',
  [ModelPipeline.imageAudioTextToText]: 'Image/Audio/Text to Text',
  [ModelPipeline.featureExtraction]: 'Feature extraction',
  [ModelPipeline.textRanking]: 'Text ranking',
};
