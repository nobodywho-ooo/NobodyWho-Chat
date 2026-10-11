import { act, renderHook } from '@testing-library/react-native';

import {
  CURATED_VOICE_PIPELINE_MODELS,
  VOICE_MODELS_RESERVED_GB,
} from 'helpers';
import { buildModel } from 'jest/factories/model';
import { ModelPipeline } from 'types';

import { useVoiceModelDownloads } from '../hooks/useVoiceModelDownloads';

const tts = buildModel(3, { pipeline: ModelPipeline.textToSpeech });
const ttsDownload = {
  model: tts,
  partsProgress: [
    {
      url: 'https://x/tts.onnx',
      fileName: 'tts.onnx',
      type: 'tts-file',
      path: '',
      sizeGB: 2,
      progress: 0.25,
    },
  ],
};

const mockCurated = {
  findCuratedToDownload: jest.fn((_curated: unknown) => [] as unknown[]),
  findModelsToDownload: jest.fn((_curated: unknown) => [] as unknown[]),
  findPendingDownloads: jest.fn((_curated: unknown) => [] as unknown[]),
  isCatalogueLoaded: true,
  isDownloading: false,
  progress: 0,
  downloadCurated: jest.fn(),
  cancel: jest.fn(),
};
const mockUseCuratedModels = jest.fn(
  (_catalogue?: unknown, _reservedGB?: unknown) => mockCurated,
);
const mockStopDownload = jest.fn();
const mockResumeDownloads = jest.fn();
let mockActiveIds = new Set<number>();

jest.mock('hooks', () => ({
  useCuratedModels: (catalogue?: unknown, reservedGB?: unknown) =>
    mockUseCuratedModels(catalogue, reservedGB),
  useModelDownloader: () => ({
    stopDownload: mockStopDownload,
    resumeDownloads: mockResumeDownloads,
  }),
  useActiveDownloadIds: () => mockActiveIds,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCurated.findPendingDownloads.mockReturnValue([]);
  mockCurated.isDownloading = false;
  mockCurated.progress = 0;
  mockActiveIds = new Set();
});

test('keeps RAM free for the voice models when fetching the catalogue', async () => {
  await renderHook(() => useVoiceModelDownloads());

  expect(mockUseCuratedModels).toHaveBeenCalledWith(
    undefined,
    VOICE_MODELS_RESERVED_GB,
  );
});

test('offers to resume a voice model download that was interrupted', async () => {
  mockCurated.findPendingDownloads.mockReturnValue([ttsDownload]);
  const { result } = await renderHook(() => useVoiceModelDownloads());

  expect(mockCurated.findPendingDownloads).toHaveBeenCalledWith(
    CURATED_VOICE_PIPELINE_MODELS,
  );
  expect(result.current.isInterrupted).toBe(true);
  expect(result.current.isDownloading).toBe(false);

  await act(async () => result.current.resume());
  expect(mockResumeDownloads).toHaveBeenCalledTimes(1);
});

test('shows the progress of a voice model download started before a remount', async () => {
  mockCurated.findPendingDownloads.mockReturnValue([ttsDownload]);
  mockActiveIds = new Set([tts.id]);
  const { result } = await renderHook(() => useVoiceModelDownloads());

  expect(result.current.isDownloading).toBe(true);
  expect(result.current.isInterrupted).toBe(false);
  expect(result.current.progress).toBe(0.25);

  // No batch of its own to cancel: stops the download it found.
  await act(async () => result.current.cancel());
  expect(mockStopDownload).toHaveBeenCalledWith(tts);
  expect(mockCurated.cancel).not.toHaveBeenCalled();
});

test("follows and cancels the screen's own batch while it runs", async () => {
  mockCurated.isDownloading = true;
  mockCurated.progress = 0.6;
  mockCurated.findPendingDownloads.mockReturnValue([ttsDownload]);
  const { result } = await renderHook(() => useVoiceModelDownloads());

  expect(result.current.isDownloading).toBe(true);
  expect(result.current.isInterrupted).toBe(false);
  expect(result.current.progress).toBe(0.6);

  await act(async () => result.current.cancel());
  expect(mockCurated.cancel).toHaveBeenCalledTimes(1);
  expect(mockStopDownload).not.toHaveBeenCalled();
});

test('is neither downloading nor interrupted with nothing on its way', async () => {
  const { result } = await renderHook(() => useVoiceModelDownloads());

  expect(result.current.isDownloading).toBe(false);
  expect(result.current.isInterrupted).toBe(false);
});
