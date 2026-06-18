import { Model, ModelPipeline } from 'types';

export const buildModel = (
  id: number,
  overrides: Partial<Model> = {},
): Model => ({
  id,
  name: `Model ${id}`,
  sizeGB: 1,
  parameterCountBillions: 1,
  author: 'Author',
  family: 'Family',
  thinking: false,
  imageIngestion: false,
  audioIngestion: false,
  huggingfaceUrl: `https://huggingface.co/test/model-${id}`,
  parts: [],
  pipeline: ModelPipeline.textGeneration,
  tags: [],
  languages: [],
  ...overrides,
});
