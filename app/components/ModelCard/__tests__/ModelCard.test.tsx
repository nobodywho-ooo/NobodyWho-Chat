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

const HEAVY_PROCESSING_LABEL = 'components.modelCard.heavyProcessing';

test('shows a heavy processing tag when the model size is above 2 GB', () => {
  const bigModel: Model = { ...mockModel, sizeGB: 2.5 };
  const { getAllByText } = render(<ModelCard model={bigModel} />);

  expect(getAllByText(HEAVY_PROCESSING_LABEL)).toHaveLength(1);
});

test('does not show a heavy processing tag when the model size is 2 GB or below', () => {
  const smallModel: Model = { ...mockModel, sizeGB: 2 };
  const { queryByText } = render(<ModelCard model={smallModel} />);

  expect(queryByText(HEAVY_PROCESSING_LABEL)).toBeNull();
});

// The warning colour used to be picked by matching the English label, so it
// went missing the moment the tag was translated. It rides on the variant now.
test('marks the heavy processing tag as a warning rather than relying on its text', () => {
  const bigModel: Model = { ...mockModel, sizeGB: 2.5 };
  const { UNSAFE_getByProps } = render(<ModelCard model={bigModel} />);

  expect(
    UNSAFE_getByProps({ label: HEAVY_PROCESSING_LABEL }).props.variant,
  ).toBe('warning');
});
