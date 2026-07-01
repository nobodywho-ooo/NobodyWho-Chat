import React from 'react';
import { Alert } from 'react-native';
import { render, act } from '@testing-library/react-native';

import {
  mockUseAppState,
  mockUseModelDownloads,
  mockUseModels,
} from 'jest/mock/hooks';
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
  // Reset between tests so a download set in one test doesn't leak into the next.
  mockUseModelDownloads.mockReturnValue({ downloads: [], loading: false });
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

test('pressing a downloading model offers to stop the download', async () => {
  const downloading = buildModel(30, { parts: [part('chat-model', 1)] });
  mockUseModelDownloads.mockReturnValue({
    downloads: [
      {
        model: downloading,
        partsProgress: downloading.parts.map(p => ({ ...p, progress: 0.5 })),
      },
    ],
    loading: false,
  });
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  const screen = render(<ModelsScreen />);
  await act(async () => {});

  // The downloading card carries a downloadProgress; pressing it offers a
  // two-button alert: stop the current download, or cancel and keep going.
  const card = screen
    .UNSAFE_getAllByType('ModelCard' as never)
    .find(node => node.props.downloadProgress !== undefined);
  act(() => card?.props.onPress(downloading));

  expect(alertSpy).toHaveBeenCalledWith(
    'screens.models.stopDownloadTitle',
    'screens.models.stopDownloadMessage',
    [
      expect.objectContaining({
        text: 'screens.models.stopDownload',
        style: 'destructive',
        onPress: expect.any(Function),
      }),
      expect.objectContaining({ text: 'common.cancel', style: 'cancel' }),
    ],
  );
  alertSpy.mockRestore();
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
