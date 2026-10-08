import { Alert } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getModelById } from 'repositories';
import { checkDiskSpaceForModels } from 'helpers';
import { ModelPipeline } from 'types';
import { buildModel } from 'jest/factories/model';

import {
  TEXT_REQUIREMENTS,
  useMissingModelDownloads,
  VOICE_REQUIREMENTS,
} from '../useMissingModelDownloads';

const mockStartDownload = jest.fn(
  async (_model: unknown, _options?: unknown) => {},
);
const mockStopDownload = jest.fn();

jest.mock('../useModelDownloader', () => ({
  useModelDownloader: () => ({
    startDownload: mockStartDownload,
    stopDownload: mockStopDownload,
  }),
}));

jest.mock('hooks', () => ({
  useModels: () => ({ models: [], loading: false }),
  useModelDownloads: () => ({ downloads: [], loading: false }),
}));

jest.mock('repositories', () => ({
  getModelById: jest.fn(),
  modelDownloadProgress: jest.fn(() => 0),
}));

jest.mock('helpers', () => ({
  MODELS_URL: 'https://catalogue',
  filterModelsByDeviceMemory: jest.fn(async (models: unknown) => models),
  log: jest.fn(),
  checkDiskSpaceForModels: jest.fn(() => ({
    fits: true,
    requiredGB: 2.5,
    availableGB: 64,
  })),
  modelSizeLabel: jest.fn((sizeGB: number) => `${sizeGB} GB`),
}));

const mockGetModelById = getModelById as jest.Mock;
const mockCheckDiskSpaceForModels = checkDiskSpaceForModels as jest.Mock;

const chat = buildModel(1, { tags: ['Great First Pick'] });
const stt = buildModel(2, {
  pipeline: ModelPipeline.speechToText,
  tags: ['Recommended'],
});
const tts = buildModel(3, {
  pipeline: ModelPipeline.textToSpeech,
  tags: ['Recommended'],
});
const vad = buildModel(4, {
  pipeline: ModelPipeline.voiceActivityDetection,
  tags: ['Recommended'],
});

const renderLoaded = async () => {
  const hook = renderHook(() => useMissingModelDownloads());
  await waitFor(() =>
    expect(hook.result.current.findMissingModels(TEXT_REQUIREMENTS)).toEqual([
      chat,
    ]),
  );
  return hook;
};

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  globalThis.fetch = jest.fn(async () => ({
    json: async () => [chat, stt, tts, vad],
  })) as unknown as typeof fetch;
  mockGetModelById.mockImplementation(async (id: number) => buildModel(id));
});

afterEach(() => {
  alertSpy.mockRestore();
});

test('downloads the requirement models and reports done', async () => {
  const { result } = await renderLoaded();

  let outcome;
  await act(async () => {
    outcome = await result.current.downloadMissing(VOICE_REQUIREMENTS);
  });

  expect(outcome).toBe('done');
  expect(mockStartDownload.mock.calls.map(([model]) => model)).toEqual([
    chat,
    stt,
    tts,
    vad,
  ]);
  expect(alertSpy).not.toHaveBeenCalled();
  expect(result.current.isDownloading).toBe(false);
});

test('refuses the whole batch with one alert when it does not fit', async () => {
  mockCheckDiskSpaceForModels.mockReturnValueOnce({
    fits: false,
    requiredGB: 4.5,
    availableGB: 1,
  });
  const { result } = await renderLoaded();

  let outcome;
  await act(async () => {
    outcome = await result.current.downloadMissing(VOICE_REQUIREMENTS);
  });

  expect(outcome).toBe('notEnoughSpace');
  expect(mockCheckDiskSpaceForModels).toHaveBeenCalledWith([
    chat,
    stt,
    tts,
    vad,
  ]);
  expect(mockStartDownload).not.toHaveBeenCalled();
  expect(alertSpy).toHaveBeenCalledTimes(1);
  expect(alertSpy).toHaveBeenCalledWith(
    'screens.models.notEnoughSpaceTitle',
    'screens.models.notEnoughSpaceMessageMultiple',
  );
});

test('names the model when a single one does not fit', async () => {
  mockCheckDiskSpaceForModels.mockReturnValueOnce({
    fits: false,
    requiredGB: 1.5,
    availableGB: 1,
  });
  const { result } = await renderLoaded();

  await act(async () => {
    await result.current.downloadMissing(TEXT_REQUIREMENTS);
  });

  expect(alertSpy).toHaveBeenCalledWith(
    'screens.models.notEnoughSpaceTitle',
    'screens.models.notEnoughSpaceMessage',
  );
});

test('alerts on failure and drops only the models that did not land', async () => {
  // stt never made it to the database; the others did.
  mockGetModelById.mockImplementation(async (id: number) =>
    id === stt.id ? undefined : buildModel(id),
  );
  const { result } = await renderLoaded();

  let outcome;
  await act(async () => {
    outcome = await result.current.downloadMissing(VOICE_REQUIREMENTS);
  });

  expect(outcome).toBe('failed');
  expect(mockStopDownload.mock.calls.map(([model]) => model)).toEqual([stt]);
  expect(alertSpy).toHaveBeenCalledWith(
    'screens.models.downloadFailedTitle',
    'screens.models.downloadFailedMessage',
  );
  expect(result.current.isDownloading).toBe(false);
});

test('fails with an alert when the catalogue cannot be fetched', async () => {
  globalThis.fetch = jest.fn(async () => {
    throw new TypeError('Network request failed');
  }) as unknown as typeof fetch;
  const { result } = renderHook(() => useMissingModelDownloads());

  let outcome;
  await act(async () => {
    outcome = await result.current.downloadMissing(TEXT_REQUIREMENTS);
  });

  expect(outcome).toBe('failed');
  expect(mockStartDownload).not.toHaveBeenCalled();
  expect(alertSpy).toHaveBeenCalledWith(
    'screens.models.downloadFailedTitle',
    'screens.models.downloadFailedMessage',
  );
  expect(result.current.isDownloading).toBe(false);
});

test('retries the catalogue when it failed to load at mount', async () => {
  const fetchMock = jest
    .fn()
    .mockRejectedValueOnce(new TypeError('Network request failed'))
    .mockResolvedValue({ json: async () => [chat] });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  const { result } = renderHook(() => useMissingModelDownloads());
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

  let outcome;
  await act(async () => {
    outcome = await result.current.downloadMissing(TEXT_REQUIREMENTS);
  });

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(outcome).toBe('done');
  expect(mockStartDownload.mock.calls.map(([model]) => model)).toEqual([chat]);
});

test('leaves the failure alert to a caller that opts out', async () => {
  mockGetModelById.mockResolvedValue(undefined);
  const { result } = await renderLoaded();

  let outcome;
  await act(async () => {
    outcome = await result.current.downloadMissing(TEXT_REQUIREMENTS, {
      alertOnFailure: false,
    });
  });

  expect(outcome).toBe('failed');
  expect(mockStopDownload.mock.calls.map(([model]) => model)).toEqual([chat]);
  expect(alertSpy).not.toHaveBeenCalled();
});

test('a cancelled batch neither alerts nor reports failure', async () => {
  let finishDownload: () => void = () => {};
  mockStartDownload.mockImplementationOnce(
    () => new Promise<void>(resolve => (finishDownload = resolve)),
  );
  mockGetModelById.mockResolvedValue(undefined);
  const { result } = await renderLoaded();

  let pending: Promise<string> = Promise.resolve('');
  act(() => {
    pending = result.current.downloadMissing(TEXT_REQUIREMENTS);
  });
  await waitFor(() => expect(result.current.isDownloading).toBe(true));

  act(() => result.current.cancel());
  await act(async () => {
    finishDownload();
    expect(await pending).toBe('cancelled');
  });

  expect(alertSpy).not.toHaveBeenCalled();
  expect(result.current.isDownloading).toBe(false);
});
