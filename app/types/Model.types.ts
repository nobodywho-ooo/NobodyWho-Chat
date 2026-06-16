export interface ModelDownloadLink {
  url: string;
  fileName: string;
  type: string;
  modelPath: string;
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
  downloadLinks: ModelDownloadLink[];
  pipeline: ModelPipeline;
  tags: string[];
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
