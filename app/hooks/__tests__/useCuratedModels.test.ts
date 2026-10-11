import { Alert } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getModelById } from 'repositories';
import {
  curatedChatModel,
  checkDiskSpaceForModels,
  CURATED_TEXT_MODELS,
  CURATED_VOICE_ONLY_MODELS,
  CURATED_VOICE_PIPELINE_MODELS,
} from 'helpers';
import { ModelPipeline } from 'types';
import { buildModel } from 'jest/factories/model';

import { useCuratedModels } from '../useCuratedModels';

const mockStartDownload = jest.fn(
  async (_model: unknown, _options?: unknown) => {},
);
const mockStopDownload = jest.fn();
const mockWarnNotEnoughSpace = jest.fn();
const mockIsDownloadActive = jest.fn((_modelId: number) => false);
let mockStoredModels: unknown[] = [];

jest.mock('../useModelDownloader', () => ({
  isDownloadActive: (modelId: number) => mockIsDownloadActive(modelId),
  useModelDownloader: () => ({
    startDownload: mockStartDownload,
    stopDownload: mockStopDownload,
    warnNotEnoughSpace: mockWarnNotEnoughSpace,
  }),
}));

jest.mock('../useModels', () => ({
  useModels: () => ({ models: mockStoredModels, loading: false }),
}));

jest.mock('../useModelDownloads', () => ({
  useModelDownloads: () => ({ downloads: [], loading: false }),
}));

jest.mock('repositories', () => ({
  getModelById: jest.fn(),
  modelDownloadProgress: jest.fn(() => 0),
}));

jest.mock('helpers', () => ({
  ...jest.requireActual('helpers/curatedModels'),
  fetchModelCatalogue: jest.fn(async () => {
    const response = await fetch('https://catalogue');
    return response.json();
  }),
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
  const hook = await renderHook(() => useCuratedModels());
  await waitFor(() =>
    expect(
      hook.result.current.findModelsToDownload(CURATED_TEXT_MODELS),
    ).toEqual([chat]),
  );
  return hook;
};

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockStoredModels = [];
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => [chat, stt, tts, vad],
  })) as unknown as typeof fetch;
  mockGetModelById.mockImplementation(async (id: number) => buildModel(id));
});

afterEach(() => {
  alertSpy.mockRestore();
});

test('downloads the curated models and reports done', async () => {
  const { result } = await renderLoaded();

  let outcome;
  await act(async () => {
    outcome = await result.current.downloadCurated(
      CURATED_VOICE_PIPELINE_MODELS,
    );
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
    outcome = await result.current.downloadCurated(
      CURATED_VOICE_PIPELINE_MODELS,
    );
  });

  expect(outcome).toBe('notEnoughSpace');
  // Nothing else is downloading here (the downloads hook is mocked empty).
  expect(mockCheckDiskSpaceForModels).toHaveBeenCalledWith(
    [chat, stt, tts, vad],
    [],
  );
  expect(mockStartDownload).not.toHaveBeenCalled();
  expect(mockWarnNotEnoughSpace).toHaveBeenCalledTimes(1);
  expect(mockWarnNotEnoughSpace).toHaveBeenCalledWith([chat, stt, tts, vad], {
    fits: false,
    requiredGB: 4.5,
    availableGB: 1,
  });
  expect(alertSpy).not.toHaveBeenCalled();
});

test('alerts on failure and drops only the models that did not land', async () => {
  // stt never made it to the database; the others did.
  mockGetModelById.mockImplementation(async (id: number) =>
    id === stt.id ? undefined : buildModel(id),
  );
  const { result } = await renderLoaded();

  let outcome;
  await act(async () => {
    outcome = await result.current.downloadCurated(
      CURATED_VOICE_PIPELINE_MODELS,
    );
  });

  expect(outcome).toBe('failed');
  expect(mockStopDownload.mock.calls.map(([model]) => model)).toEqual([stt]);
  expect(alertSpy).toHaveBeenCalledWith(
    'screens.models.downloadFailedTitle',
    'screens.models.downloadFailedMessage',
  );
  expect(result.current.isDownloading).toBe(false);
});

test('reports a failed download the resume picked back up as still in progress', async () => {
  mockGetModelById.mockImplementation(async (id: number) =>
    id === stt.id ? undefined : buildModel(id),
  );
  mockIsDownloadActive.mockImplementation(modelId => modelId === stt.id);
  const { result } = await renderLoaded();

  let outcome;
  await act(async () => {
    outcome = await result.current.downloadCurated(
      CURATED_VOICE_PIPELINE_MODELS,
    );
  });

  expect(outcome).toBe('inProgress');
  expect(mockStopDownload).not.toHaveBeenCalled();
  expect(alertSpy).not.toHaveBeenCalled();
});

test('cleans nothing up when the result cannot be read back', async () => {
  // Some models may have landed: guessing would delete installed files.
  mockGetModelById.mockRejectedValue(new Error('database locked'));
  const { result } = await renderLoaded();

  let outcome;
  await act(async () => {
    outcome = await result.current.downloadCurated(
      CURATED_VOICE_PIPELINE_MODELS,
    );
  });

  expect(outcome).toBe('failed');
  expect(mockStopDownload).not.toHaveBeenCalled();
  expect(result.current.isDownloading).toBe(false);
});

test('fails with an alert when the catalogue cannot be fetched', async () => {
  globalThis.fetch = jest.fn(async () => {
    throw new TypeError('Network request failed');
  }) as unknown as typeof fetch;
  const { result } = await renderHook(() => useCuratedModels());

  let outcome;
  await act(async () => {
    outcome = await result.current.downloadCurated(CURATED_TEXT_MODELS);
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
  const { result } = await renderHook(() => useCuratedModels());
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

  let outcome;
  await act(async () => {
    outcome = await result.current.downloadCurated(CURATED_TEXT_MODELS);
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
    outcome = await result.current.downloadCurated(CURATED_TEXT_MODELS, {
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
  await act(() => {
    pending = result.current.downloadCurated(CURATED_TEXT_MODELS);
  });
  await waitFor(() => expect(result.current.isDownloading).toBe(true));

  await act(() => result.current.cancel());
  await act(async () => {
    finishDownload();
    expect(await pending).toBe('cancelled');
  });

  expect(alertSpy).not.toHaveBeenCalled();
  expect(result.current.isDownloading).toBe(false);
});

test('uses a catalogue it is given without fetching one', async () => {
  const { result } = await renderHook(() =>
    useCuratedModels([chat, stt, tts, vad]),
  );

  expect(
    result.current.findModelsToDownload(CURATED_VOICE_PIPELINE_MODELS),
  ).toEqual([chat, stt, tts, vad]);

  await act(async () => {
    await result.current.downloadCurated(CURATED_TEXT_MODELS);
  });

  expect(mockStartDownload).toHaveBeenCalledWith(chat, {
    alertOnFailure: false,
  });
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

// The catalogue tags chat models Recommended too: only one of them may land.
const recommendedChat = buildModel(5, { tags: ['Recommended'] });
const startedModels = () =>
  mockStartDownload.mock.calls.map(([model]) => model);

test('the curated voice models download a single chat model, the Great First Pick', async () => {
  const { result } = await renderHook(() =>
    useCuratedModels([recommendedChat, chat, stt, tts, vad]),
  );

  expect(
    result.current.findModelsToDownload(CURATED_VOICE_PIPELINE_MODELS),
  ).toEqual([chat, stt, tts, vad]);

  await act(async () => {
    await result.current.downloadCurated(CURATED_VOICE_PIPELINE_MODELS);
  });

  expect(startedModels()).toEqual([chat, stt, tts, vad]);
});

test('a chat model picked by id replaces the Great First Pick', async () => {
  const { result } = await renderHook(() =>
    useCuratedModels([chat, recommendedChat, stt, tts, vad]),
  );

  await act(async () => {
    await result.current.downloadCurated([
      curatedChatModel(recommendedChat.id),
      ...CURATED_VOICE_ONLY_MODELS,
    ]);
  });

  expect(startedModels()).toEqual([recommendedChat, stt, tts, vad]);
});

test("any chat model covers the default pick, but not the user's own pick", async () => {
  const otherChat = buildModel(9, { tags: ['Recommended'] });
  mockStoredModels = [otherChat];
  const { result } = await renderHook(() =>
    useCuratedModels([chat, stt, tts, vad]),
  );

  expect(result.current.findModelsToDownload(CURATED_TEXT_MODELS)).toEqual([]);

  let outcome;
  await act(async () => {
    outcome = await result.current.downloadCurated([curatedChatModel(chat.id)]);
  });

  expect(outcome).toBe('done');
  expect(startedModels()).toEqual([chat]);
});
