import React from 'react';
import { Alert, ScrollView } from 'react-native';
import { render, act, fireEvent } from '@testing-library/react-native';

import {
  mockUseAppState,
  mockUseModelDownloads,
  mockUseModels,
} from 'jest/mock/hooks';
import { mockFetchResolve, mockFetchReject } from 'jest/mock/network';
import { mockGetTotalMemory } from 'jest/mock/node-modules';
import { buildModel } from 'jest/factories/model';
import { resetModelCatalogueForTests } from 'services';

import { ModelsScreen } from '../ModelsScreen';

// The Downloaded tab selects/deletes through the engine slots; only the
// native-backed handles are stubbed.
jest.mock('services', () => ({
  ...jest.requireActual('services'),
  useAiService: () => ({ slots: {} }),
}));

const GB = 1024 ** 3;

const part = (type: string, sizeGB: number) => ({
  url: `https://example.com/${type}.gguf`,
  fileName: `${type}.gguf`,
  type,
  path: '',
  sizeGB,
});

beforeEach(() => {
  resetModelCatalogueForTests();
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

  const screen = await render(<ModelsScreen />);
  await act(async () => {});
  expect(screen.toJSON()).toMatchSnapshot();
});

test('0 models to download (network failure), 1 model downloaded and 1 in use', async () => {
  mockUseModels.mockReturnValue({ models: [buildModel(10)] });
  mockUseAppState.mockReturnValue({ modelIdInUse: 10 });
  mockFetchReject();

  const screen = await render(<ModelsScreen />);
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

  const screen = await render(<ModelsScreen />);
  await act(async () => {});

  // The downloading card carries a downloadProgress; pressing it offers a
  // two-button alert: stop the current download, or cancel and keep going.
  const [card] = screen.container.queryAll(
    node =>
      node.type === 'ModelCard' && node.props.downloadProgress !== undefined,
  );
  await act(() => card?.props.onPress(downloading));

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

  const screen = await render(<ModelsScreen />);
  await act(async () => {});

  const tree = JSON.stringify(screen.toJSON());
  expect(tree).toContain('Model 20');
  expect(tree).not.toContain('Model 21');
});

test('0 models to download (network failure), 0 models downloaded and no model in use', async () => {
  mockUseModels.mockReturnValue({ models: [] });
  mockUseAppState.mockReturnValue({});
  mockFetchReject();

  const screen = await render(<ModelsScreen />);
  await act(async () => {});
  expect(screen.toJSON()).toMatchSnapshot();
});

test('the category pills switch between discover, in use and downloaded', async () => {
  const inUse = buildModel(10);
  const downloaded = buildModel(11);
  mockUseModels.mockReturnValue({ models: [inUse, downloaded] });
  mockUseAppState.mockReturnValue({ modelIdInUse: 10 });
  mockFetchResolve([buildModel(20)]);

  const screen = await render(<ModelsScreen />);
  await act(async () => {});

  const shownModels = () =>
    screen.container
      .queryAll(node => node.type === 'ModelCard')
      .map(card => card.props.model.id);

  // Discover is selected first and lists only what can still be downloaded.
  expect(shownModels()).toEqual([20]);

  await fireEvent.press(screen.getByLabelText('screens.models.inUse'));
  expect(shownModels()).toEqual([10]);

  await fireEvent.press(screen.getByLabelText('screens.models.downloaded'));
  expect(shownModels()).toEqual([10, 11]);

  await fireEvent.press(screen.getByLabelText('screens.models.discover'));
  expect(shownModels()).toEqual([20]);
});

test('in use and downloaded tabs show an empty state', async () => {
  const screen = await render(<ModelsScreen />);
  await act(async () => {});

  await fireEvent.press(screen.getByLabelText('screens.models.inUse'));
  expect(screen.getByText('screens.models.noModelInUse')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('screens.models.downloaded'));
  expect(
    screen.getByText('screens.downloadedModels.noModelDownloaded'),
  ).toBeTruthy();
});

describe('scrolling to the top when a download starts', () => {
  const hooks = jest.requireMock('hooks');
  // The mocked ScrollView shares one scrollTo jest.fn across instances.
  const scrollTo = (ScrollView.prototype as unknown as { scrollTo: jest.Mock })
    .scrollTo;
  const downloadOf = (model: ReturnType<typeof buildModel>) => ({
    model,
    partsProgress: model.parts.map(p => ({ ...p, progress: 0 })),
  });

  let startDownload: jest.Mock;
  let alertSpy: jest.SpyInstance<void, Parameters<typeof Alert.alert>>;

  beforeEach(() => {
    startDownload = jest.fn();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(hooks, 'useModelDownloader').mockReturnValue({
      startDownload,
      promptStopDownload: jest.fn(),
    });
    scrollTo.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderAndPress = async (model: ReturnType<typeof buildModel>) => {
    mockFetchResolve([model]);
    const screen = await render(<ModelsScreen />);
    await act(async () => {});

    const [card] = screen.container.queryAll(
      node => node.type === 'ModelCard' && node.props.model.id === model.id,
    );
    await act(() => card.props.onPress(model));
    return screen;
  };

  // Presses the confirmation alert's button with the given text.
  const answerConfirm = async (text: string) => {
    const buttons = alertSpy.mock.calls.at(-1)?.[2] ?? [];
    const button = buttons.find(b => b.text === text);
    await act(async () => button?.onPress?.());
  };

  test('waits for the pressed model to appear among the downloads', async () => {
    const model = buildModel(20, { parts: [part('chat-model', 1)] });
    const screen = await renderAndPress(model);

    expect(startDownload).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'screens.models.confirmDownloadTitle',
      'screens.models.confirmDownloadMessage',
      expect.any(Array),
    );
    await answerConfirm('screens.models.confirmDownload');

    expect(startDownload).toHaveBeenCalledWith(model);
    expect(scrollTo).not.toHaveBeenCalled();

    mockUseModelDownloads.mockReturnValue({
      downloads: [downloadOf(model)],
      loading: false,
    });
    await screen.rerender(<ModelsScreen />);

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
  });

  test('another model starting to download does not scroll', async () => {
    const model = buildModel(20, { parts: [part('chat-model', 1)] });
    const other = buildModel(30, { parts: [part('chat-model', 1)] });
    const screen = await renderAndPress(model);
    await answerConfirm('screens.models.confirmDownload');

    mockUseModelDownloads.mockReturnValue({
      downloads: [downloadOf(other)],
      loading: false,
    });
    await screen.rerender(<ModelsScreen />);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  test('cancelling the confirmation does not download', async () => {
    const model = buildModel(20, { parts: [part('chat-model', 1)] });
    await renderAndPress(model);
    await answerConfirm('common.cancel');

    expect(startDownload).not.toHaveBeenCalled();
  });
});
