import { Alert, AppState } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  createModelDownload,
  deleteModelDownload,
  getModelDownloads,
  insertModel,
  updateModelDownloadParts,
} from 'repositories';
import { getAppState, setAppState } from 'database';
import {
  checkDiskSpaceForModel,
  deleteModelDirectory,
  downloadModelPart,
  log,
} from 'helpers';
import { ModelPipeline } from 'types';
import { buildModel } from 'jest/factories/model';

import {
  useModelDownloader,
  useResumeModelDownloads,
} from '../useModelDownloader';

jest.mock('repositories', () => ({
  createModelDownload: jest.fn(async () => true),
  deleteModelDownload: jest.fn(async () => {}),
  getModelDownloads: jest.fn(async () => []),
  insertModel: jest.fn(async () => {}),
  updateModelDownloadParts: jest.fn(async () => {}),
}));

jest.mock('database', () => ({
  DEFAULT_ASSISTANT_CONFIG: {},
  getAppState: jest.fn(() => ({ modelIdInUse: 1 })),
  setAppState: jest.fn(async () => {}),
}));

jest.mock('helpers', () => ({
  NetworkError: class NetworkError extends Error {},
  downloadModelPart: jest.fn(),
  deleteModelDirectory: jest.fn(),
  log: jest.fn(),
  // Unit-tested in diskSpace.test.ts; here the default is a device with room,
  // and a test flips it to exercise the refusal.
  checkDiskSpaceForModel: jest.fn(() => ({
    fits: true,
    requiredGB: 1.5,
    availableGB: 64,
  })),
  modelSizeLabel: jest.fn((sizeGB: number) => `${sizeGB} GB`),
  // Unit-tested in ttsVoices.test.ts; here we only care that the auto-select
  // spreads its result into the persisted config.
  resolveTtsPrefs: jest.fn(() => ({})),
}));

const mockGetModelDownloads = getModelDownloads as jest.Mock;
const mockDeleteModelDownload = deleteModelDownload as jest.Mock;
const mockInsertModel = insertModel as jest.Mock;
const mockDownloadModelPart = downloadModelPart as jest.Mock;
const mockDeleteModelDirectory = deleteModelDirectory as jest.Mock;
const mockCheckDiskSpaceForModel = checkDiskSpaceForModel as jest.Mock;
const mockSetAppState = setAppState as jest.Mock;
const mockLog = log as jest.Mock;

// A pending download for a single-part model, keyed by a unique id per test so
// the module-level `activeDownloads` map can't leak state between tests.
const pendingDownload = (
  id: number,
  pipeline: ModelPipeline = ModelPipeline.textGeneration,
) => {
  const model = buildModel(id, {
    pipeline,
    parts: [
      {
        url: `https://x/model-${id}.gguf`,
        fileName: `model-${id}.gguf`,
        type:
          pipeline === ModelPipeline.textToSpeech ? 'tts-file' : 'chat-model',
        path: '',
        sizeGB: 1,
      },
    ],
  });
  return {
    model,
    partsProgress: model.parts.map(part => ({ ...part, progress: 0 })),
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  // clearAllMocks keeps implementations, so undo a previous test's rejection.
  mockInsertModel.mockResolvedValue(undefined);
  mockGetModelDownloads.mockResolvedValue([]);
  (createModelDownload as jest.Mock).mockResolvedValue(true);
  (updateModelDownloadParts as jest.Mock).mockResolvedValue(undefined);
  (setAppState as jest.Mock).mockResolvedValue(undefined);
  (getAppState as jest.Mock).mockReturnValue({ modelIdInUse: 1 });
  mockCheckDiskSpaceForModel.mockReturnValue({
    fits: true,
    requiredGB: 1.5,
    availableGB: 64,
  });
});

test('the download screens leave resuming to useResumeModelDownloads', async () => {
  mockGetModelDownloads.mockResolvedValue([pendingDownload(110)]);

  renderHook(() => useModelDownloader());
  await act(async () => {});

  expect(mockGetModelDownloads).not.toHaveBeenCalled();
  expect(mockDownloadModelPart).not.toHaveBeenCalled();
});

test('resumes pending downloads again when the app returns to the foreground', async () => {
  // Already a mock in the react-native jest preset.
  const addListener = AppState.addEventListener as jest.Mock;
  mockDownloadModelPart.mockResolvedValue('/docs/models/111/model-111.gguf');

  renderHook(() => useResumeModelDownloads());
  await waitFor(() => expect(mockGetModelDownloads).toHaveBeenCalledTimes(1));
  expect(mockDownloadModelPart).not.toHaveBeenCalled();

  // A download that failed while offline is still pending on the way back.
  mockGetModelDownloads.mockResolvedValue([pendingDownload(111)]);
  const onChange = addListener.mock.calls.find(
    ([type]) => type === 'change',
  )?.[1] as (state: string) => void;
  await act(async () => onChange('active'));

  await waitFor(() => expect(mockInsertModel).toHaveBeenCalled());
  expect(mockGetModelDownloads).toHaveBeenCalledTimes(2);
});

test('keeps the pending download on a transient error so it can resume later', async () => {
  const download = pendingDownload(101);
  mockGetModelDownloads.mockResolvedValue([download]);
  // A network failure mid-download (NOT an abort).
  mockDownloadModelPart.mockRejectedValue(new Error('network dropped'));

  renderHook(() => useResumeModelDownloads());

  await waitFor(() => expect(mockDownloadModelPart).toHaveBeenCalled());
  // The record and the bytes on disk must survive so the foreground resume
  // picks it back up — neither is torn down on a non-abort failure.
  await waitFor(() => expect(mockGetModelDownloads).toHaveBeenCalled());
  expect(mockDeleteModelDownload).not.toHaveBeenCalled();
  expect(mockDeleteModelDirectory).not.toHaveBeenCalled();
  expect(mockInsertModel).not.toHaveBeenCalled();
});

test('alerts the user when a download fails', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockGetModelDownloads.mockResolvedValue([pendingDownload(107)]);
  mockDownloadModelPart.mockRejectedValue(new Error('network dropped'));

  renderHook(() => useResumeModelDownloads());

  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith(
      'screens.models.downloadFailedTitle',
      'screens.models.downloadFailedModelMessage',
    ),
  );
  alert.mockRestore();
});

test('leaves the failure alert to a caller that opts out', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockDownloadModelPart.mockRejectedValue(new Error('network dropped'));

  const { result } = renderHook(() => useModelDownloader());
  await act(async () => {
    await result.current.startDownload(pendingDownload(108).model, {
      alertOnFailure: false,
    });
  });

  expect(mockDownloadModelPart).toHaveBeenCalled();
  expect(alert).not.toHaveBeenCalled();
  alert.mockRestore();
});

test('does not alert when the user stops a download', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const { model } = pendingDownload(109);
  mockDownloadModelPart.mockImplementation(
    (_id, _url, _file, signal: AbortSignal) =>
      new Promise((_, reject) =>
        signal.addEventListener('abort', () => reject(new Error('aborted'))),
      ),
  );

  const { result } = renderHook(() => useModelDownloader());
  let started: Promise<void> = Promise.resolve();
  act(() => {
    started = result.current.startDownload(model);
  });
  await waitFor(() => expect(mockDownloadModelPart).toHaveBeenCalled());

  await act(async () => {
    result.current.stopDownload(model);
    await started;
  });

  expect(alert).not.toHaveBeenCalled();
  alert.mockRestore();
});

test('reports an unexpected download failure to Sentry', async () => {
  mockGetModelDownloads.mockResolvedValue([pendingDownload(103)]);
  mockDownloadModelPart.mockRejectedValue(new Error('ranged chunk mismatch'));

  renderHook(() => useResumeModelDownloads());

  await waitFor(() =>
    expect(mockLog).toHaveBeenCalledWith(
      'ModelsScreen runDownload',
      expect.any(Error),
      { capture: true },
    ),
  );
});

test('does not report an unreachable remote to Sentry', async () => {
  const { NetworkError } = jest.requireMock('helpers');
  mockGetModelDownloads.mockResolvedValue([pendingDownload(104)]);
  mockDownloadModelPart.mockRejectedValue(new NetworkError('HEAD timed out'));

  renderHook(() => useResumeModelDownloads());

  await waitFor(() =>
    expect(mockLog).toHaveBeenCalledWith(
      'ModelsScreen runDownload',
      expect.any(Error),
      { capture: false },
    ),
  );
});

test('installs the model and clears the download on success', async () => {
  const download = pendingDownload(102);
  mockGetModelDownloads.mockResolvedValue([download]);
  mockDownloadModelPart.mockResolvedValue('/docs/models/102/model-102.gguf');

  renderHook(() => useResumeModelDownloads());

  await waitFor(() => expect(mockInsertModel).toHaveBeenCalled());
  expect(mockDeleteModelDownload).toHaveBeenCalledWith(102);
  expect(mockDeleteModelDirectory).not.toHaveBeenCalled();
});

test('a first chat model fills the empty chat slot on completion', async () => {
  (getAppState as jest.Mock).mockReturnValue({});
  const download = pendingDownload(103);
  mockGetModelDownloads.mockResolvedValue([download]);
  mockDownloadModelPart.mockResolvedValue('/docs/models/103/model-103.gguf');

  renderHook(() => useResumeModelDownloads());

  await waitFor(() =>
    expect(mockSetAppState).toHaveBeenCalledWith({
      modelIdInUse: 103,
      conversationIdInUse: undefined,
    }),
  );
});

test('a TTS model fills the voice slot — never the chat slot', async () => {
  // No model of either kind selected yet: the strongest bait for the
  // auto-select to wrongly put a voice model in the chat slot.
  (getAppState as jest.Mock).mockReturnValue({});
  const download = pendingDownload(104, ModelPipeline.textToSpeech);
  mockGetModelDownloads.mockResolvedValue([download]);
  mockDownloadModelPart.mockResolvedValue('/docs/models/104/model-104.gguf');

  renderHook(() => useResumeModelDownloads());

  await waitFor(() =>
    expect(mockSetAppState).toHaveBeenCalledWith(
      expect.objectContaining({ ttsModelIdInUse: 104 }),
    ),
  );
  expect(mockSetAppState).not.toHaveBeenCalledWith(
    expect.objectContaining({ modelIdInUse: 104 }),
  );
});

test('a failing insert drops the download row and files instead of retrying forever', async () => {
  const download = pendingDownload(105);
  mockGetModelDownloads.mockResolvedValue([download]);
  mockDownloadModelPart.mockResolvedValue('/docs/models/105/model-105.gguf');
  // e.g. a stale dev database whose pipeline CHECK predates this model.
  mockInsertModel.mockRejectedValue(new Error('CHECK constraint failed'));

  renderHook(() => useResumeModelDownloads());

  await waitFor(() =>
    expect(mockDeleteModelDownload).toHaveBeenCalledWith(105),
  );
  expect(mockDeleteModelDirectory).toHaveBeenCalledWith(105);
  expect(mockSetAppState).not.toHaveBeenCalled();
});

describe('startDownload disk-space guard', () => {
  const model = () => buildModel(106, { name: 'Tiny', sizeGB: 4 });

  test('refuses a model that does not fit and tells the user', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockCheckDiskSpaceForModel.mockReturnValue({
      fits: false,
      requiredGB: 4.5,
      availableGB: 1,
    });

    const { result } = renderHook(() => useModelDownloader());
    await act(async () => {
      await result.current.startDownload(model());
    });

    expect(alert).toHaveBeenCalledWith(
      'screens.models.notEnoughSpaceTitle',
      'screens.models.notEnoughSpaceMessage',
    );
    expect(createModelDownload).not.toHaveBeenCalled();
    expect(mockDownloadModelPart).not.toHaveBeenCalled();
  });

  test('starts the download when the model fits', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockDownloadModelPart.mockResolvedValue('/docs/models/106/model.gguf');

    const { result } = renderHook(() => useModelDownloader());
    await act(async () => {
      await result.current.startDownload(
        buildModel(106, {
          parts: [
            {
              url: 'https://x/model.gguf',
              fileName: 'model.gguf',
              type: 'chat-model',
              path: '',
              sizeGB: 1,
            },
          ],
        }),
      );
    });

    expect(alert).not.toHaveBeenCalled();
    expect(createModelDownload).toHaveBeenCalled();
    expect(mockDownloadModelPart).toHaveBeenCalled();
  });
});
