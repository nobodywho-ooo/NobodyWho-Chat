import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  useActiveDownloadIds,
  useHasResumedAtLaunch,
  useModelDownloads,
} from 'hooks';
import { buildModel } from 'jest/factories/model';
import { ModelPipeline } from 'types';

import { NoModelDownloadedScreen } from '../NoModelDownloadedScreen';

const mockResumeDownloads = jest.fn();
const mockPromptStopDownloads = jest.fn();

jest.mock('hooks', () => ({
  ...jest.requireActual('hooks'),
  useModelDownloads: jest.fn(() => ({ downloads: [], loading: false })),
  useActiveDownloadIds: jest.fn(() => new Set()),
  useHasResumedAtLaunch: jest.fn(() => true),
  useModelDownloader: () => ({
    resumeDownloads: mockResumeDownloads,
    promptStopDownloads: mockPromptStopDownloads,
  }),
}));

const mockUseModelDownloads = useModelDownloads as jest.Mock;
const mockUseActiveDownloadIds = useActiveDownloadIds as jest.Mock;

const downloadOf = (
  id: number,
  name: string,
  { pipeline = ModelPipeline.textGeneration, sizeGB = 1, progress = 0 } = {},
) => {
  const part = {
    url: `https://x/model-${id}.gguf`,
    fileName: `model-${id}.gguf`,
    type: 'chat-model',
    path: '',
    sizeGB,
  };
  const model = buildModel(id, { name, pipeline, parts: [part] });
  return { model, partsProgress: [{ ...part, progress }] };
};

const lfm = downloadOf(1, 'LFM2.5');
const bonsai = downloadOf(2, 'Bonsai');
const whisper = downloadOf(3, 'Whisper', {
  pipeline: ModelPipeline.speechToText,
});

const setDownloads = (downloads: unknown[], activeIds: number[]) => {
  mockUseModelDownloads.mockReturnValue({ downloads, loading: false });
  mockUseActiveDownloadIds.mockReturnValue(new Set(activeIds));
};

beforeEach(() => {
  jest.clearAllMocks();
  setDownloads([], []);
  (useHasResumedAtLaunch as jest.Mock).mockReturnValue(true);
});

test('renders correctly NoModelDownloadedScreen', async () => {
  const tree = (await render(<NoModelDownloadedScreen />)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('shows the chat model download in progress instead', async () => {
  setDownloads([lfm], [lfm.model.id]);
  await render(<NoModelDownloadedScreen />);

  screen.getByText('screens.noModelDownloaded.downloadingTitle');
  screen.getByText('screens.noModelDownloaded.downloadProgress');
  expect(
    screen.queryByText('screens.noModelDownloaded.noModelAvailable'),
  ).toBeNull();
  expect(screen.queryByTestId('resume-download-button')).toBeNull();
});

test('shows one overall progress for every chat model download', async () => {
  setDownloads([lfm, bonsai], [lfm.model.id, bonsai.model.id]);
  await render(<NoModelDownloadedScreen />);

  // One percentage (weighted by size, see overallDownloadProgress), no
  // per-model list.
  expect(
    screen.getAllByText('screens.noModelDownloaded.downloadProgress'),
  ).toHaveLength(1);
  expect(screen.queryByText('LFM2.5')).toBeNull();
  expect(screen.queryByText('Bonsai')).toBeNull();
});

test('offers to resume once every chat model download is interrupted', async () => {
  setDownloads([lfm], []);
  await render(<NoModelDownloadedScreen />);

  screen.getByText('screens.noModelDownloaded.interruptedTitle');
  await fireEvent.press(screen.getByTestId('resume-download-button'));
  expect(mockResumeDownloads).toHaveBeenCalledTimes(1);
});

test('shows downloading, not interrupted, until the launch resume has run', async () => {
  (useHasResumedAtLaunch as jest.Mock).mockReturnValue(false);
  setDownloads([lfm], []);
  await render(<NoModelDownloadedScreen />);

  screen.getByText('screens.noModelDownloaded.downloadingTitle');
  expect(screen.queryByTestId('resume-download-button')).toBeNull();
});

test('hides Resume while a chat model is still downloading', async () => {
  setDownloads([lfm, bonsai], [bonsai.model.id]);
  await render(<NoModelDownloadedScreen />);

  screen.getByText('screens.noModelDownloaded.downloadingTitle');
  expect(screen.queryByTestId('resume-download-button')).toBeNull();
});

test('only a chat model download counts as downloading', async () => {
  // The voice model is running, the chat model is not.
  setDownloads([lfm, whisper], [whisper.model.id]);
  await render(<NoModelDownloadedScreen />);

  screen.getByText('screens.noModelDownloaded.interruptedTitle');
  screen.getByTestId('resume-download-button');
});

test('offers to stop every chat model download at once', async () => {
  setDownloads([lfm, bonsai, whisper], [bonsai.model.id]);
  await render(<NoModelDownloadedScreen />);

  await fireEvent.press(screen.getByTestId('stop-download-button'));
  expect(mockPromptStopDownloads).toHaveBeenCalledWith([
    lfm.model,
    bonsai.model,
  ]);
});

test('ignores downloads that are not a chat model', async () => {
  setDownloads([whisper], []);
  await render(<NoModelDownloadedScreen />);

  screen.getByText('screens.noModelDownloaded.noModelAvailable');
});
