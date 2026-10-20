import { act, renderHook } from '@testing-library/react-native';

import { CURATED_VOICE_PIPELINE_MODELS, CuratedAvailability } from 'helpers';
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
  availabilityOf: jest.fn((_curated: unknown): CuratedAvailability => ({
    kind: 'ready',
  })),
  isDownloading: false,
  progress: 0,
  downloadCurated: jest.fn(),
  cancel: jest.fn(),
};
const mockPromptStopDownloads = jest.fn();
const mockResumeDownloads = jest.fn();
let mockActiveIds = new Set<number>();

jest.mock('hooks', () => ({
  useCuratedModels: () => mockCurated,
  useModelDownloader: () => ({
    promptStopDownloads: mockPromptStopDownloads,
    resumeDownloads: mockResumeDownloads,
  }),
  useActiveDownloadIds: () => mockActiveIds,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCurated.availabilityOf.mockReturnValue({ kind: 'ready' });
  mockCurated.isDownloading = false;
  mockCurated.progress = 0;
  mockActiveIds = new Set();
});

test.each<[CuratedAvailability, string]>([
  [{ kind: 'loading' }, 'loading'],
  [{ kind: 'ready' }, 'ready'],
  [{ kind: 'automatic', models: [tts], sizeGB: 2 }, 'automatic'],
  [{ kind: 'manual' }, 'manual'],
])('%p voice models set up as %p', async (availability, state) => {
  mockCurated.availabilityOf.mockReturnValue(availability);
  const { result } = await renderHook(() => useVoiceModelDownloads());

  expect(mockCurated.availabilityOf).toHaveBeenCalledWith(
    CURATED_VOICE_PIPELINE_MODELS,
  );
  expect(result.current.state).toBe(state);
});

test('downloads the curated voice models', async () => {
  mockCurated.availabilityOf.mockReturnValue({
    kind: 'automatic',
    models: [tts],
    sizeGB: 2,
  });
  const { result } = await renderHook(() => useVoiceModelDownloads());

  await act(async () => result.current.download());

  expect(mockCurated.downloadCurated).toHaveBeenCalledWith(
    CURATED_VOICE_PIPELINE_MODELS,
  );
});

test('offers to resume a voice model download that was interrupted', async () => {
  mockCurated.availabilityOf.mockReturnValue({
    kind: 'inProgress',
    downloads: [ttsDownload],
  });
  const { result } = await renderHook(() => useVoiceModelDownloads());

  expect(result.current.state).toBe('interrupted');

  await act(async () => result.current.resume());
  expect(mockResumeDownloads).toHaveBeenCalledTimes(1);
});

test('shows the progress of a voice model download started before a remount', async () => {
  mockCurated.availabilityOf.mockReturnValue({
    kind: 'inProgress',
    downloads: [ttsDownload],
  });
  mockActiveIds = new Set([tts.id]);
  const { result } = await renderHook(() => useVoiceModelDownloads());

  expect(result.current.state).toBe('downloading');
  expect(result.current.progress).toBe(0.25);

  // No batch of its own to cancel: asks before stopping the download it found.
  await act(async () => result.current.cancel());
  expect(mockPromptStopDownloads).toHaveBeenCalledWith([tts]);
  expect(mockCurated.cancel).not.toHaveBeenCalled();
});

test("follows and cancels the screen's own batch while it runs", async () => {
  mockCurated.isDownloading = true;
  mockCurated.progress = 0.6;
  mockCurated.availabilityOf.mockReturnValue({
    kind: 'inProgress',
    downloads: [ttsDownload],
  });
  const { result } = await renderHook(() => useVoiceModelDownloads());

  expect(result.current.state).toBe('downloading');
  expect(result.current.progress).toBe(0.6);

  await act(async () => result.current.cancel());
  expect(mockCurated.cancel).toHaveBeenCalledTimes(1);
  expect(mockPromptStopDownloads).not.toHaveBeenCalled();
});
