export interface Model {
  id: number;
  modelName: string;
  modelSizeGB: number;
  parameterCountBillions: number;
  author: string;
  fileName: string;
  downloadURL: string;
  tags: string[];
}

export enum ModelPaths {
  modelPath = "modelPath",
  projectionModelPath = "projectionModelPath"
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
