import React from 'react';
import { render } from '@testing-library/react-native';
import { Model, ModelPipeline } from 'types';

import { ModelCard } from '../ModelCard';

jest.unmock('../ModelCard');

const mockModel: Model = {
  id: 1,
  modelName: 'Qwen3 4B Q4 K M',
  modelSizeGB: 2.5,
  parameterCountBillions: 4,
  author: 'Qwen',
  family: 'Qwen3',
  paths: [
    {
      modelPath:
        'https://huggingface.co/NobodyWho/Qwen_Qwen3-4B-GGUF/resolve/main/Qwen_Qwen3-4B-Q4_K_M.gguf',
      fileName: 'Qwen_Qwen3-4B-Q4_K_M.gguf',
    },
  ],
  pipeline: ModelPipeline.textGeneration,
  tags: ['Thinking'],
};

test('renders correctly ModelCard', () => {
  const tree = render(<ModelCard model={mockModel} />).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders correctly ModelCard when downloading', () => {
  const tree = render(
    <ModelCard model={mockModel} downloadProgress={0.4} />,
  ).toJSON();
  expect(tree).toMatchSnapshot();
});
