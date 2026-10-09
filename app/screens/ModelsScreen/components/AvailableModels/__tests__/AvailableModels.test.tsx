import React from 'react';
import {
  render,
  fireEvent,
  act,
  type RenderResult,
} from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';

import { buildModel } from 'jest/factories/model';
import { getPipelineIcon } from 'helpers';
import { ModelPipeline, pipelineLabel } from 'types';

import { AvailableModels } from '../AvailableModels';

const queryCards = (screen: RenderResult) =>
  screen.container.queryAll(node => node.type === 'ModelCard');
const isPlatformIcon = (node: TestInstance) => node.type === 'PlatformIcon';

const defaultProps = {
  models: [],
  isLoading: false,
  hasError: false,
  hasFetched: false,
  onModelPress: jest.fn(),
  onRetry: jest.fn(),
  onInfoPress: jest.fn(),
};

test('renders correctly AvailableModels while loading', async () => {
  const screen = await render(<AvailableModels {...defaultProps} isLoading />);
  expect(screen.toJSON()).toMatchSnapshot();
});

test('renders correctly AvailableModels with a list of models', async () => {
  const screen = await render(
    <AvailableModels
      {...defaultProps}
      hasFetched
      models={[buildModel(1), buildModel(2)]}
    />,
  );
  expect(screen.toJSON()).toMatchSnapshot();
});

test('renders correctly AvailableModels on error', async () => {
  const screen = await render(
    <AvailableModels {...defaultProps} hasFetched hasError />,
  );
  expect(screen.toJSON()).toMatchSnapshot();
});

test('renders correctly AvailableModels when everything is downloaded', async () => {
  const screen = await render(<AvailableModels {...defaultProps} hasFetched />);
  expect(screen.toJSON()).toMatchSnapshot();
});

test('renders a card per available model', async () => {
  const models = [buildModel(1), buildModel(2), buildModel(3)];
  const screen = await render(
    <AvailableModels {...defaultProps} hasFetched models={models} />,
  );

  const cards = queryCards(screen);
  expect(cards).toHaveLength(3);
});

test('does not show models while still loading', async () => {
  const screen = await render(
    <AvailableModels {...defaultProps} isLoading models={[buildModel(1)]} />,
  );
  expect(queryCards(screen)).toHaveLength(0);
});

test('does not show the "all downloaded" message before the first fetch', async () => {
  const screen = await render(<AvailableModels {...defaultProps} />);
  const tree = JSON.stringify(screen.toJSON());
  expect(tree).not.toContain('youHaveDownloadedAllTheModels');
});

test('pressing the info button invokes onInfoPress', async () => {
  const onInfoPress = jest.fn();
  const screen = await render(
    <AvailableModels {...defaultProps} onInfoPress={onInfoPress} />,
  );

  await fireEvent.press(
    screen.getByLabelText('screens.models.chooseModelTitle'),
  );
  expect(onInfoPress).toHaveBeenCalledTimes(1);
});

test('pressing a model invokes onModelPress', async () => {
  const onModelPress = jest.fn();
  const model = buildModel(1);
  const screen = await render(
    <AvailableModels
      {...defaultProps}
      hasFetched
      models={[model]}
      onModelPress={onModelPress}
    />,
  );

  const [card] = screen.container.queryAll(node => node.props.model === model);
  await act(() => card.props.onPress(model));
  expect(onModelPress).toHaveBeenCalledWith(model);
});

test('retrying from the error state invokes onRetry', async () => {
  const onRetry = jest.fn();
  const screen = await render(
    <AvailableModels {...defaultProps} hasFetched hasError onRetry={onRetry} />,
  );

  const [retryButton] = screen.container.queryAll(
    node => node.type === 'Button' && node.props.onPress === onRetry,
  );
  await fireEvent.press(retryButton);
  expect(onRetry).toHaveBeenCalledTimes(1);
});

// --- Catalogue order -------------------------------------------------------
test('models carrying an "order" come first, ascending, then the rest', async () => {
  const models = [
    buildModel(1),
    buildModel(2, { order: 2 }),
    buildModel(3),
    buildModel(4, { order: 1 }),
  ];
  const screen = await render(
    <AvailableModels {...defaultProps} hasFetched models={models} />,
  );

  const cards = queryCards(screen);
  // 4 and 2 are pinned; 1 and 3 keep the order the catalogue sent them in.
  expect(cards.map(card => card.props.model.id)).toEqual([4, 2, 1, 3]);
});

test('the order holds within a pipeline filter', async () => {
  const models = [
    buildModel(1, { pipeline: ModelPipeline.textToSpeech }),
    buildModel(2, { order: 1 }),
    buildModel(3, { pipeline: ModelPipeline.textToSpeech, order: 2 }),
    buildModel(4, { pipeline: ModelPipeline.textToSpeech, order: 1 }),
  ];
  const screen = await render(
    <AvailableModels {...defaultProps} hasFetched models={models} />,
  );

  await fireEvent.press(
    screen.getByLabelText(pipelineLabel[ModelPipeline.textToSpeech]),
  );

  const cards = queryCards(screen);
  expect(cards.map(card => card.props.model.id)).toEqual([4, 3, 1]);
});

// --- Pipeline filtering ----------------------------------------------------
const mixedModels = [
  buildModel(1),
  buildModel(2, { pipeline: ModelPipeline.textToSpeech }),
  buildModel(3, { pipeline: ModelPipeline.speechToText }),
];

const renderMixed = async (models = mixedModels) =>
  await render(
    <AvailableModels {...defaultProps} hasFetched models={models} />,
  );

test('offers a pill per pipeline on offer, plus "All", and starts unfiltered', async () => {
  const screen = await renderMixed();

  expect(
    screen.getByLabelText('screens.models.allPipelines').props
      .accessibilityState.selected,
  ).toBe(true);
  expect(
    screen.getByLabelText(pipelineLabel[ModelPipeline.textToSpeech]),
  ).toBeTruthy();
  expect(
    screen.getByLabelText(pipelineLabel[ModelPipeline.speechToText]),
  ).toBeTruthy();
  // No pill for a pipeline no available model uses.
  expect(
    screen.queryByLabelText(pipelineLabel[ModelPipeline.featureExtraction]),
  ).toBeNull();
  expect(queryCards(screen)).toHaveLength(3);
});

test("selecting a pipeline shows only that pipeline's models", async () => {
  const screen = await renderMixed();

  await fireEvent.press(
    screen.getByLabelText(pipelineLabel[ModelPipeline.textToSpeech]),
  );

  const cards = queryCards(screen);
  expect(cards).toHaveLength(1);
  expect(cards[0].props.model.pipeline).toBe(ModelPipeline.textToSpeech);
  expect(
    screen.getByLabelText(pipelineLabel[ModelPipeline.textToSpeech]).props
      .accessibilityState.selected,
  ).toBe(true);
});

test('"All" clears the filter', async () => {
  const screen = await renderMixed();

  await fireEvent.press(
    screen.getByLabelText(pipelineLabel[ModelPipeline.textToSpeech]),
  );
  await fireEvent.press(screen.getByLabelText('screens.models.allPipelines'));

  expect(queryCards(screen)).toHaveLength(3);
});

test('the filter resets when the selected pipeline leaves the catalogue', async () => {
  const screen = await renderMixed();

  await fireEvent.press(
    screen.getByLabelText(pipelineLabel[ModelPipeline.textToSpeech]),
  );

  // The TTS model gets downloaded, so it drops off the available list.
  await screen.rerender(
    <AvailableModels
      {...defaultProps}
      hasFetched
      models={[mixedModels[0], mixedModels[2]]}
    />,
  );

  expect(
    screen.getByLabelText('screens.models.allPipelines').props
      .accessibilityState.selected,
  ).toBe(true);
  expect(queryCards(screen)).toHaveLength(2);
});

test('no filter row when every available model shares one pipeline', async () => {
  const screen = await render(
    <AvailableModels
      {...defaultProps}
      hasFetched
      models={[buildModel(1), buildModel(2)]}
    />,
  );

  expect(screen.queryByLabelText('screens.models.allPipelines')).toBeNull();
  expect(
    screen.queryByLabelText(pipelineLabel[ModelPipeline.textGeneration]),
  ).toBeNull();
});

test('no filter row while loading or on error', async () => {
  const loading = await render(
    <AvailableModels {...defaultProps} isLoading models={mixedModels} />,
  );
  expect(loading.queryByLabelText('screens.models.allPipelines')).toBeNull();

  const errored = await render(
    <AvailableModels
      {...defaultProps}
      hasError
      hasFetched
      models={mixedModels}
    />,
  );
  expect(errored.queryByLabelText('screens.models.allPipelines')).toBeNull();
});

test('each pipeline pill carries its own icon, and "All" carries none', async () => {
  const screen = await renderMixed();

  const ttsPill = screen.getByLabelText(
    pipelineLabel[ModelPipeline.textToSpeech],
  );
  const [icon] = ttsPill.queryAll(isPlatformIcon);
  expect(icon.props.iosIconName).toBe(
    getPipelineIcon(ModelPipeline.textToSpeech).iosIconName,
  );
  expect(icon.props.androidIconName).toBe(
    getPipelineIcon(ModelPipeline.textToSpeech).androidIconName,
  );

  const allPill = screen.getByLabelText('screens.models.allPipelines');
  expect(allPill.queryAll(isPlatformIcon)).toHaveLength(0);
});
