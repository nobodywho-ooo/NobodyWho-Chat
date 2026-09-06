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
  toolCalling: true,
  huggingfaceUrl: 'https://huggingface.co/Qwen/Qwen3-4B-GGUF',
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
  supportedFileFormat: [],
};

test('renders correctly ModelCard', () => {
  const tree = render(<ModelCard model={mockModel} />).toJSON();
  expect(tree).toMatchSnapshot();
});

test('labels a sub-million parameter count in thousands', () => {
  // A voice-detection model is ~300K parameters; the millions-only label used
  // to flatten every one of them to "(0M)".
  const { getByText } = render(
    <ModelCard
      model={{
        ...mockModel,
        parameterCountBillions: 0.000309,
        pipeline: ModelPipeline.voiceActivityDetection,
      }}
    />,
  );

  expect(getByText('(309K)')).toBeTruthy();
});

test('drops the parameter label for a model with no known count', () => {
  const { queryByText } = render(
    <ModelCard model={{ ...mockModel, parameterCountBillions: 0 }} />,
  );

  expect(queryByText('(0M)')).toBeNull();
  expect(queryByText('(0K)')).toBeNull();
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

test('shows a High CPU usage tag when the model size is above 2 GB', () => {
  const bigModel: Model = { ...mockModel, sizeGB: 2.5 };
  const { getAllByText } = render(<ModelCard model={bigModel} />);

  expect(getAllByText('High CPU usage')).toHaveLength(1);
});

test('does not show a High CPU usage tag when the model size is 2 GB or below', () => {
  const smallModel: Model = { ...mockModel, sizeGB: 2 };
  const { queryByText } = render(<ModelCard model={smallModel} />);

  expect(queryByText('High CPU usage')).toBeNull();
});
