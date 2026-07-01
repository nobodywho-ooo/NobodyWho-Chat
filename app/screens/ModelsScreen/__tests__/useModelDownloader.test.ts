import { renderHook, waitFor } from '@testing-library/react-native';

import {
  createModelDownload,
  deleteModelDownload,
  getModelDownloads,
  insertModel,
  updateModelDownloadParts,
} from 'repositories';
import { getAppState, setAppState } from 'database';
import { deleteModelPartFiles, downloadModelPart } from 'helpers';
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
  getAppState: jest.fn(() => ({ modelIdInUse: 1 })),
  setAppState: jest.fn(async () => {}),
}));

jest.mock('helpers', () => ({
  downloadModelPart: jest.fn(),
  deleteModelPartFiles: jest.fn(),
  log: jest.fn(),
}));

const mockGetModelDownloads = getModelDownloads as jest.Mock;
const mockDeleteModelDownload = deleteModelDownload as jest.Mock;
const mockInsertModel = insertModel as jest.Mock;
const mockDownloadModelPart = downloadModelPart as jest.Mock;
const mockDeleteModelPartFiles = deleteModelPartFiles as jest.Mock;

// A pending download for a single-part model, keyed by a unique id per test so
// the module-level `activeDownloads` map can't leak state between tests.
const pendingDownload = (id: number) => {
  const model = buildModel(id, {
    parts: [
      {
        url: `https://x/model-${id}.gguf`,
        fileName: `model-${id}.gguf`,
        type: 'chat-model',
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
  expect(mockDeleteModelPartFiles).not.toHaveBeenCalled();
  expect(mockInsertModel).not.toHaveBeenCalled();
});

test('installs the model and clears the download on success', async () => {
  const download = pendingDownload(102);
  mockGetModelDownloads.mockResolvedValue([download]);
  mockDownloadModelPart.mockResolvedValue('/docs/models/model-102.gguf');

  renderHook(() => useModelDownloader());

  await waitFor(() => expect(mockInsertModel).toHaveBeenCalled());
  expect(mockDeleteModelDownload).toHaveBeenCalledWith(102);
  expect(mockDeleteModelPartFiles).not.toHaveBeenCalled();
});
