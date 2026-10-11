import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

import { fetchModelCatalogue } from 'helpers';
import { buildModel } from 'jest/factories/model';
import { ModelPipeline } from 'types';

import { OnboardingScreen } from '../OnboardingScreen';

jest.mock('../components/OnboardingChoices/OnboardingChoices', () => ({
  OnboardingChoices: 'OnboardingChoices',
}));

jest.mock('helpers', () => ({
  ...jest.requireActual('helpers'),
  fetchModelCatalogue: jest.fn(),
  log: jest.fn(),
}));

const mockFetchModelCatalogue = fetchModelCatalogue as jest.Mock;

const catalogue = [buildModel(1, { tags: ['Great First Pick'] })];

const choices = () =>
  screen.container.queryAll(node => node.type === 'OnboardingChoices');

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchModelCatalogue.mockResolvedValue(catalogue);
});

test('shows a loader while the catalogue is fetched', async () => {
  mockFetchModelCatalogue.mockReturnValue(new Promise(() => {}));
  await render(<OnboardingScreen onFinish={jest.fn()} />);

  screen.getByText('screens.onboarding.loadingModels');
  expect(choices()).toEqual([]);
});

test('leaves for the app when the catalogue cannot be fetched', async () => {
  mockFetchModelCatalogue.mockRejectedValue(new Error('offline'));
  const onFinish = jest.fn();
  await render(<OnboardingScreen onFinish={onFinish} />);

  await screen.findByText('screens.onboarding.loadingModels');
  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(choices()).toEqual([]);
});

test('leaves for the app when no text model fits the device', async () => {
  mockFetchModelCatalogue.mockResolvedValue([
    buildModel(2, { pipeline: ModelPipeline.speechToText }),
  ]);
  const onFinish = jest.fn();
  await render(<OnboardingScreen onFinish={onFinish} />);

  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
  expect(choices()).toEqual([]);
});

test('fetches once and hands the catalogue to the choices', async () => {
  const onFinish = jest.fn();
  const { rerender } = await render(<OnboardingScreen onFinish={onFinish} />);
  await waitFor(() => expect(choices()).toHaveLength(1));
  // App passes a new onFinish on every render.
  const nextOnFinish = jest.fn();
  await rerender(<OnboardingScreen onFinish={nextOnFinish} />);

  expect(mockFetchModelCatalogue).toHaveBeenCalledTimes(1);
  const [onboardingChoices] = choices();
  expect(onboardingChoices.props.catalogue).toBe(catalogue);
  expect(onboardingChoices.props.onFinish).toBe(nextOnFinish);
});
