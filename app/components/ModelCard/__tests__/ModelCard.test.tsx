import React from 'react';
import { render } from '@testing-library/react-native';
import { Model, ModelPipeline } from 'types';

import { ModelCard } from '../ModelCard';

jest.unmock('../ModelCard');

const mockModel: Model = {
  id: 1,
  name: 'Qwen3 4B Q4 K M',
  sizeGB: 2.5,
  parameterCountBillions: 4,
  author: 'Qwen',
  family: 'Qwen3',
  thinking: true,
  imageIngestion: false,
  audioIngestion: false,
  parts: [
    {
      url: 'https://huggingface.co/NobodyWho/Qwen_Qwen3-4B-GGUF/resolve/main/Qwen_Qwen3-4B-Q4_K_M.gguf',
      fileName: 'Qwen_Qwen3-4B-Q4_K_M.gguf',
      type: 'model',
      path: '',
      sizeGB: 2.5,
    },
  ],
  pipeline: ModelPipeline.textGeneration,
  tags: ['Multilingual'],
  languages: ['English', 'Arabic', 'Chinese', 'French'],
};

test('renders correctly ModelCard', () => {
  const tree = render(<ModelCard model={mockModel} />).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders correctly ModelCard when model is downloading', () => {
  const tree = render(
    <ModelCard model={mockModel} downloadProgress={0.4} />,
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders correctly ModelCard when model is downloaded', () => {
  const tree = render(<ModelCard model={mockModel} isDownloaded />).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders correctly ModelCard when model is selected', () => {
  const tree = render(<ModelCard model={mockModel} isSelected />).toJSON();
  expect(tree).toMatchSnapshot();
});
