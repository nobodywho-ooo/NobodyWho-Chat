import React from 'react';
import { render, act } from '@testing-library/react-native';

import { mockUseAppState, mockUseModels } from 'jest/mock/hooks';
import { mockFetchResolve, mockFetchReject } from 'jest/mock/network';
import { buildModel } from 'jest/factories/model';

import { ModelsScreen } from '../ModelsScreen';

beforeEach(() => {
  mockUseModels.mockReturnValue({ models: [] });
  mockUseAppState.mockReturnValue({});
  mockFetchResolve([]);
});

test('2 models to download, 2 models downloaded and 1 in use', async () => {
  const downloaded = [buildModel(10), buildModel(11)];
  mockUseModels.mockReturnValue({ models: downloaded });
  mockUseAppState.mockReturnValue({ modelIdInUse: 10 });
  mockFetchResolve([buildModel(20), buildModel(21)]);

  const screen = render(<ModelsScreen />);
  await act(async () => {});
  expect(screen.toJSON()).toMatchSnapshot();
});

test('0 models to download (network failure), 1 model downloaded and 1 in use', async () => {
  mockUseModels.mockReturnValue({ models: [buildModel(10)] });
  mockUseAppState.mockReturnValue({ modelIdInUse: 10 });
  mockFetchReject();

  const screen = render(<ModelsScreen />);
  await act(async () => {});
  expect(screen.toJSON()).toMatchSnapshot();
});

test('0 models to download (network failure), 0 models downloaded and no model in use', async () => {
  mockUseModels.mockReturnValue({ models: [] });
  mockUseAppState.mockReturnValue({});
  mockFetchReject();

  const screen = render(<ModelsScreen />);
  await act(async () => {});
  expect(screen.toJSON()).toMatchSnapshot();
});
