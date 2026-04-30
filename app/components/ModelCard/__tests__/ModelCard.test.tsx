import React from 'react';
import { render } from '@testing-library/react-native';
import { Model } from 'types';

import { ModelCard } from '../ModelCard';

jest.unmock('../ListItem');

test('renders correctly ModelCard', () => {
  const model: Model = {
    id: 1,
    modelName: 'Qwen3 4B Q4 K M',
    modelSizeGB: 2.5,
    parameterCountBillions: 4,
    author: 'Qwen',
    fileName: 'Qwen_Qwen3-4B-Q4_K_M.gguf',
    downloadURL:
      'https://huggingface.co/NobodyWho/Qwen_Qwen3-4B-GGUF/resolve/main/Qwen_Qwen3-4B-Q4_K_M.gguf',
    tags: ['Thinking'],
  };
  const tree = render(<ModelCard model={model} />).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders correctly ModelCard when downloading', () => {
  const model: Model = {
    id: 1,
    modelName: 'Qwen3 4B Q4 K M',
    modelSizeGB: 2.5,
    parameterCountBillions: 4,
    author: 'Qwen',
    fileName: 'Qwen_Qwen3-4B-Q4_K_M.gguf',
    downloadURL:
      'https://huggingface.co/NobodyWho/Qwen_Qwen3-4B-GGUF/resolve/main/Qwen_Qwen3-4B-Q4_K_M.gguf',
    tags: ['Thinking'],
  };
  const tree = render(<ModelCard model={model} />).toJSON();
  expect(tree).toMatchSnapshot();
});
