import { Model, ModelPipeline } from 'types';

export const buildModel = (
  id: number,
  overrides: Partial<Model> = {},
): Model => ({
  id,
  modelName: `Model ${id}`,
  modelSizeGB: 1,
  parameterCountBillions: 1,
  author: 'Author',
  family: 'Family',
  thinking: false,
  imageIngestion: false,
  audioIngestion: false,
  downloadLinks: [],
  pipeline: ModelPipeline.textGeneration,
  tags: [],
  ...overrides,
});
