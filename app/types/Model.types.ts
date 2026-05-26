export interface ModelPath {
  url: string;
  fileName: string;
  type: string;
}

export interface Model {
  id: number;
  modelName: string;
  modelSizeGB: number;
  parameterCountBillions: number;
  author: string;
  family: string;
  paths: ModelPath[];
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
  [ModelPipeline.imageTextToText]: 'Image/Text to text',
  [ModelPipeline.audioTextToText]: 'Audio/Text to text',
  [ModelPipeline.imageAudioTextToText]: 'Image/Audio/Text to text',
  [ModelPipeline.featureExtraction]: 'Feature extraction',
  [ModelPipeline.textRanking]: 'Text ranking',
};
