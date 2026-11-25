import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

import { buildModel } from 'jest/factories/model';
import { getDeviceCatalogue } from 'services';
import { ModelPipeline } from 'types';

import { OnboardingScreen } from '../OnboardingScreen';

jest.mock('../components/OnboardingChoices/OnboardingChoices', () => ({
  OnboardingChoices: 'OnboardingChoices',
}));

jest.mock('../../LoadingScreen/LoadingScreen', () => ({
  LoadingScreen: 'LoadingScreen',
}));

jest.mock('helpers', () => ({
  ...jest.requireActual('helpers'),
  log: jest.fn(),
}));

jest.mock('services', () => ({
  getDeviceCatalogue: jest.fn(),
}));

const mockGetDeviceCatalogue = getDeviceCatalogue as jest.Mock;

const part = (sizeGB: number) => ({
  url: 'https://example.com/model.gguf',
  fileName: 'model.gguf',
  type: 'chat-model',
  path: '',
  sizeGB,
});

const firstPick = buildModel(1, {
  tags: ['Great First Pick'],
  parts: [part(1)],
});
const catalogue = { models: [firstPick], ramGB: 8 };

const choices = () =>
  screen.container.queryAll(node => node.type === 'OnboardingChoices');
const loaders = () =>
  screen.container.queryAll(node => node.type === 'LoadingScreen');

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDeviceCatalogue.mockResolvedValue(catalogue);
});

test('shows a plain loader while the catalogue is fetched', async () => {
  mockGetDeviceCatalogue.mockReturnValue(new Promise(() => {}));
  await render(<OnboardingScreen onFinish={jest.fn()} />);

  const [loader] = loaders();
  // No onboarding wording: there may turn out to be no onboarding.
  expect(loader.props.message).toBeUndefined();
  expect(choices()).toEqual([]);
});

test('leaves for the app when the catalogue cannot be fetched', async () => {
  mockGetDeviceCatalogue.mockRejectedValue(new Error('offline'));
  const onFinish = jest.fn();
  await render(<OnboardingScreen onFinish={onFinish} />);

  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
  expect(choices()).toEqual([]);
});

test('leaves for the app when there is no suggested text model', async () => {
  mockGetDeviceCatalogue.mockResolvedValue({
    models: [
      buildModel(2),
      buildModel(3, { pipeline: ModelPipeline.speechToText }),
    ],
    ramGB: 8,
  });
  const onFinish = jest.fn();
  await render(<OnboardingScreen onFinish={onFinish} />);

  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
  expect(choices()).toEqual([]);
});

test('leaves for the app when no suggested text model fits the device', async () => {
  // 2.5 GB on iOS leaves 0.5 GB, short of the 1 GB model.
  mockGetDeviceCatalogue.mockResolvedValue({
    models: [firstPick],
    ramGB: 2.5,
  });
  const onFinish = jest.fn();
  await render(<OnboardingScreen onFinish={onFinish} />);

  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
  expect(choices()).toEqual([]);
});

test('fetches once and hands the catalogue to the choices', async () => {
  const onFinish = jest.fn();
  const { rerender } = await render(<OnboardingScreen onFinish={onFinish} />);
  await waitFor(() => expect(choices()).toHaveLength(1));
  const nextOnFinish = jest.fn();
  await rerender(<OnboardingScreen onFinish={nextOnFinish} />);

  expect(mockGetDeviceCatalogue).toHaveBeenCalledTimes(1);
  const [onboardingChoices] = choices();
  expect(onboardingChoices.props.catalogue).toBe(catalogue);
  expect(onboardingChoices.props.onFinish).toBe(nextOnFinish);
  expect(onFinish).not.toHaveBeenCalled();
});
