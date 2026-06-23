import React from 'react';
import { render, act } from '@testing-library/react-native';

import { mockUseAppState, mockUseModels } from 'jest/mock/hooks';
import { mockFetchResolve, mockFetchReject } from 'jest/mock/network';
import { mockGetTotalMemory } from 'jest/mock/node-modules';
import { buildModel } from 'jest/factories/model';

import { ModelsScreen } from '../ModelsScreen';

const GB = 1024 ** 3;

const part = (type: string, sizeGB: number) => ({
  url: `https://example.com/${type}.gguf`,
  fileName: `${type}.gguf`,
  type,
  path: '',
  sizeGB,
});

beforeEach(() => {
  mockUseModels.mockReturnValue({ models: [] });
  mockUseAppState.mockReturnValue({});
  mockFetchResolve([]);
  mockGetTotalMemory.mockResolvedValue(8 * GB);
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

test('hides models that need more RAM than the device has', async () => {
  // 8 GB total, 2 GB reserved for the OS -> 6 GB usable.
  const fits = buildModel(20, { parts: [part('chat-model', 5)] });
  const tooBig = buildModel(21, { parts: [part('chat-model', 7)] });
  mockFetchResolve([fits, tooBig]);

  const screen = render(<ModelsScreen />);
  await act(async () => {});

  const tree = JSON.stringify(screen.toJSON());
  expect(tree).toContain('Model 20');
  expect(tree).not.toContain('Model 21');
});

test('0 models to download (network failure), 0 models downloaded and no model in use', async () => {
  mockUseModels.mockReturnValue({ models: [] });
  mockUseAppState.mockReturnValue({});
  mockFetchReject();

  const screen = render(<ModelsScreen />);
  await act(async () => {});
  expect(screen.toJSON()).toMatchSnapshot();
});
