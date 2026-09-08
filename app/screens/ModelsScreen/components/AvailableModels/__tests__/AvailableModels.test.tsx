import React from 'react';
import { render, fireEvent, act, within } from '@testing-library/react-native';

import { buildModel } from 'jest/factories/model';
import { getPipelineIcon } from 'helpers';
import { ModelPipeline, pipelineLabel } from 'types';

import { AvailableModels } from '../AvailableModels';

const defaultProps = {
  models: [],
  isLoading: false,
  hasError: false,
  hasFetched: false,
  onModelPress: jest.fn(),
  onRetry: jest.fn(),
  onInfoPress: jest.fn(),
};

test('renders correctly AvailableModels while loading', () => {
  const screen = render(<AvailableModels {...defaultProps} isLoading />);
  expect(screen.toJSON()).toMatchSnapshot();
});

test('renders correctly AvailableModels with a list of models', () => {
  const screen = render(
    <AvailableModels
      {...defaultProps}
      hasFetched
      models={[buildModel(1), buildModel(2)]}
    />,
  );
  expect(screen.toJSON()).toMatchSnapshot();
});

test('renders correctly AvailableModels on error', () => {
  const screen = render(
    <AvailableModels {...defaultProps} hasFetched hasError />,
  );
  expect(screen.toJSON()).toMatchSnapshot();
});

test('renders correctly AvailableModels when everything is downloaded', () => {
  const screen = render(<AvailableModels {...defaultProps} hasFetched />);
  expect(screen.toJSON()).toMatchSnapshot();
});

test('renders a card per available model', () => {
  const models = [buildModel(1), buildModel(2), buildModel(3)];
  const screen = render(
    <AvailableModels {...defaultProps} hasFetched models={models} />,
  );

  const cards = screen.UNSAFE_getAllByType('ModelCard' as never);
  expect(cards).toHaveLength(3);
});

test('does not show models while still loading', () => {
  const screen = render(
    <AvailableModels {...defaultProps} isLoading models={[buildModel(1)]} />,
  );
  expect(screen.UNSAFE_queryAllByType('ModelCard' as never)).toHaveLength(0);
});

test('does not show the "all downloaded" message before the first fetch', () => {
  const screen = render(<AvailableModels {...defaultProps} />);
  const tree = JSON.stringify(screen.toJSON());
  expect(tree).not.toContain('youHaveDownloadedAllTheModels');
});

test('pressing the info button invokes onInfoPress', () => {
  const onInfoPress = jest.fn();
  const screen = render(
    <AvailableModels {...defaultProps} onInfoPress={onInfoPress} />,
  );

  fireEvent.press(screen.getByLabelText('screens.models.chooseModelTitle'));
  expect(onInfoPress).toHaveBeenCalledTimes(1);
});

test('pressing a model invokes onModelPress', () => {
  const onModelPress = jest.fn();
  const model = buildModel(1);
  const screen = render(
    <AvailableModels
      {...defaultProps}
      hasFetched
      models={[model]}
      onModelPress={onModelPress}
    />,
  );

  const card = screen.UNSAFE_getByProps({ model });
  act(() => card.props.onPress(model));
  expect(onModelPress).toHaveBeenCalledWith(model);
});

test('retrying from the error state invokes onRetry', () => {
  const onRetry = jest.fn();
  const screen = render(
    <AvailableModels {...defaultProps} hasFetched hasError onRetry={onRetry} />,
  );

  const errorView = screen.UNSAFE_getByProps({ onRetry });
  act(() => errorView.props.onRetry());
  expect(onRetry).toHaveBeenCalledTimes(1);
});

// --- Pipeline filtering ----------------------------------------------------
const mixedModels = [
  buildModel(1),
  buildModel(2, { pipeline: ModelPipeline.textToSpeech }),
  buildModel(3, { pipeline: ModelPipeline.speechToText }),
];

const renderMixed = (models = mixedModels) =>
  render(<AvailableModels {...defaultProps} hasFetched models={models} />);

test('offers a pill per pipeline on offer, plus "All", and starts unfiltered', () => {
  const screen = renderMixed();

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
  expect(screen.UNSAFE_getAllByType('ModelCard' as never)).toHaveLength(3);
});

test("selecting a pipeline shows only that pipeline's models", () => {
  const screen = renderMixed();

  fireEvent.press(
    screen.getByLabelText(pipelineLabel[ModelPipeline.textToSpeech]),
  );

  const cards = screen.UNSAFE_getAllByType('ModelCard' as never);
  expect(cards).toHaveLength(1);
  expect(cards[0].props.model.pipeline).toBe(ModelPipeline.textToSpeech);
  expect(
    screen.getByLabelText(pipelineLabel[ModelPipeline.textToSpeech]).props
      .accessibilityState.selected,
  ).toBe(true);
});

test('"All" clears the filter', () => {
  const screen = renderMixed();

  fireEvent.press(
    screen.getByLabelText(pipelineLabel[ModelPipeline.textToSpeech]),
  );
  fireEvent.press(screen.getByLabelText('screens.models.allPipelines'));

  expect(screen.UNSAFE_getAllByType('ModelCard' as never)).toHaveLength(3);
});

test('the filter resets when the selected pipeline leaves the catalogue', () => {
  const screen = renderMixed();

  fireEvent.press(
    screen.getByLabelText(pipelineLabel[ModelPipeline.textToSpeech]),
  );

  // The TTS model gets downloaded, so it drops off the available list.
  screen.update(
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
  expect(screen.UNSAFE_getAllByType('ModelCard' as never)).toHaveLength(2);
});

test('no filter row when every available model shares one pipeline', () => {
  const screen = render(
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

test('no filter row while loading or on error', () => {
  const loading = render(
    <AvailableModels {...defaultProps} isLoading models={mixedModels} />,
  );
  expect(loading.queryByLabelText('screens.models.allPipelines')).toBeNull();

  const errored = render(
    <AvailableModels
      {...defaultProps}
      hasError
      hasFetched
      models={mixedModels}
    />,
  );
  expect(errored.queryByLabelText('screens.models.allPipelines')).toBeNull();
});

test('each pipeline pill carries its own icon, and "All" carries none', () => {
  const screen = renderMixed();

  const ttsPill = screen.getByLabelText(
    pipelineLabel[ModelPipeline.textToSpeech],
  );
  const icon = within(ttsPill).UNSAFE_getByType('PlatformIcon' as never);
  expect(icon.props.iosIconName).toBe(
    getPipelineIcon(ModelPipeline.textToSpeech).iosIconName,
  );
  expect(icon.props.androidIconName).toBe(
    getPipelineIcon(ModelPipeline.textToSpeech).androidIconName,
  );

  const allPill = screen.getByLabelText('screens.models.allPipelines');
  expect(
    within(allPill).UNSAFE_queryAllByType('PlatformIcon' as never),
  ).toHaveLength(0);
});
