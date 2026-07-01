import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

import { buildModel } from 'jest/factories/model';

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
  const screen = render(<AvailableModels {...defaultProps} hasFetched hasError />);
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
    <AvailableModels
      {...defaultProps}
      isLoading
      models={[buildModel(1)]}
    />,
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
