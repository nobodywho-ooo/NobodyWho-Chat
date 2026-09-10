import { renderHook, waitFor } from '@testing-library/react-native';

import {
  createModelDownload,
  deleteModelDownload,
  getModelDownloads,
  insertModel,
  updateModelDownloadParts,
} from 'repositories';
import { getAppState, setAppState } from 'database';
import { deleteModelDirectory, downloadModelPart } from 'helpers';
import { ModelPipeline } from 'types';
import { buildModel } from 'jest/factories/model';

import { useModelDownloader } from '../useModelDownloader';

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
  downloadModelPart: jest.fn(),
  deleteModelDirectory: jest.fn(),
  log: jest.fn(),
  // Unit-tested in ttsVoices.test.ts; here we only care that the auto-select
  // spreads its result into the persisted config.
  resolveTtsPrefs: jest.fn(() => ({})),
}));

const mockGetModelDownloads = getModelDownloads as jest.Mock;
const mockDeleteModelDownload = deleteModelDownload as jest.Mock;
const mockInsertModel = insertModel as jest.Mock;
const mockDownloadModelPart = downloadModelPart as jest.Mock;
const mockDeleteModelDirectory = deleteModelDirectory as jest.Mock;
const mockSetAppState = setAppState as jest.Mock;

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
        type: pipeline === ModelPipeline.textToSpeech ? 'tts-file' : 'chat-model',
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
  mockGetModelDownloads.mockResolvedValue([]);
  (createModelDownload as jest.Mock).mockResolvedValue(true);
  (updateModelDownloadParts as jest.Mock).mockResolvedValue(undefined);
  (setAppState as jest.Mock).mockResolvedValue(undefined);
  (getAppState as jest.Mock).mockReturnValue({ modelIdInUse: 1 });
});

test('keeps the pending download on a transient error so it can resume later', async () => {
  const download = pendingDownload(101);
  mockGetModelDownloads.mockResolvedValue([download]);
  // A network failure mid-download (NOT an abort).
  mockDownloadModelPart.mockRejectedValue(new Error('network dropped'));

  renderHook(() => useModelDownloader());

  await waitFor(() => expect(mockDownloadModelPart).toHaveBeenCalled());
  // The record and the bytes on disk must survive so the foreground resume
  // picks it back up — neither is torn down on a non-abort failure.
  await waitFor(() =>
    expect(mockGetModelDownloads).toHaveBeenCalled(),
  );
  expect(mockDeleteModelDownload).not.toHaveBeenCalled();
  expect(mockDeleteModelDirectory).not.toHaveBeenCalled();
  expect(mockInsertModel).not.toHaveBeenCalled();
});

test('installs the model and clears the download on success', async () => {
  const download = pendingDownload(102);
  mockGetModelDownloads.mockResolvedValue([download]);
  mockDownloadModelPart.mockResolvedValue('/docs/models/102/model-102.gguf');

  renderHook(() => useModelDownloader());

  await waitFor(() => expect(mockInsertModel).toHaveBeenCalled());
  expect(mockDeleteModelDownload).toHaveBeenCalledWith(102);
  expect(mockDeleteModelDirectory).not.toHaveBeenCalled();
});

test('a first chat model fills the empty chat slot on completion', async () => {
  (getAppState as jest.Mock).mockReturnValue({});
  const download = pendingDownload(103);
  mockGetModelDownloads.mockResolvedValue([download]);
  mockDownloadModelPart.mockResolvedValue('/docs/models/103/model-103.gguf');

  renderHook(() => useModelDownloader());

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

  renderHook(() => useModelDownloader());

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

  renderHook(() => useModelDownloader());

  await waitFor(() => expect(mockDeleteModelDownload).toHaveBeenCalledWith(105));
  expect(mockDeleteModelDirectory).toHaveBeenCalledWith(105);
  expect(mockSetAppState).not.toHaveBeenCalled();
});
