import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { useActiveDownloadIds, useModelDownloads } from 'hooks';
import { buildModel } from 'jest/factories/model';
import { ModelPipeline } from 'types';

import { NoModelDownloadedScreen } from '../NoModelDownloadedScreen';

const mockResumeDownloads = jest.fn();

jest.mock('hooks', () => ({
  ...jest.requireActual('hooks'),
  useModelDownloads: jest.fn(() => ({ downloads: [], loading: false })),
  useActiveDownloadIds: jest.fn(() => new Set()),
  useModelDownloader: () => ({ resumeDownloads: mockResumeDownloads }),
}));

const mockUseModelDownloads = useModelDownloads as jest.Mock;
const mockUseActiveDownloadIds = useActiveDownloadIds as jest.Mock;

const downloadOf = (
  id: number,
  name: string,
  pipeline = ModelPipeline.textGeneration,
) => {
  const model = buildModel(id, { name, pipeline });
  return { model, partsProgress: [] };
};

const lfm = downloadOf(1, 'LFM2.5');
const bonsai = downloadOf(2, 'Bonsai');

const setDownloads = (downloads: unknown[], activeIds: number[]) => {
  mockUseModelDownloads.mockReturnValue({ downloads, loading: false });
  mockUseActiveDownloadIds.mockReturnValue(new Set(activeIds));
};

beforeEach(() => {
  jest.clearAllMocks();
  setDownloads([], []);
});

test('renders correctly NoModelDownloadedScreen', async () => {
  const tree = (await render(<NoModelDownloadedScreen />)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('shows the chat model download in progress instead', async () => {
  setDownloads([lfm], [lfm.model.id]);
  await render(<NoModelDownloadedScreen />);

  screen.getByText('screens.noModelDownloaded.downloadingTitle');
  screen.getByText('LFM2.5');
  screen.getByText('screens.noModelDownloaded.downloadProgress');
  expect(
    screen.queryByText('screens.noModelDownloaded.noModelAvailable'),
  ).toBeNull();
  expect(screen.queryByTestId('resume-download-button')).toBeNull();
});

test('offers to resume a paused chat model download', async () => {
  setDownloads([lfm], []);
  await render(<NoModelDownloadedScreen />);

  screen.getByText('screens.noModelDownloaded.pausedTitle');
  screen.getByText('screens.noModelDownloaded.pausedProgress');
  await fireEvent.press(screen.getByTestId('resume-download-button'));
  expect(mockResumeDownloads).toHaveBeenCalledTimes(1);
});

test('lists every chat model download, still downloading while one is paused', async () => {
  setDownloads([lfm, bonsai], [bonsai.model.id]);
  await render(<NoModelDownloadedScreen />);

  screen.getByText('screens.noModelDownloaded.downloadingTitle');
  screen.getByText('LFM2.5');
  screen.getByText('Bonsai');
  screen.getByText('screens.noModelDownloaded.pausedProgress');
  screen.getByText('screens.noModelDownloaded.downloadProgress');
  screen.getByTestId('resume-download-button');
});

test('ignores downloads that are not a chat model', async () => {
  setDownloads([downloadOf(3, 'Whisper', ModelPipeline.speechToText)], []);
  await render(<NoModelDownloadedScreen />);

  screen.getByText('screens.noModelDownloaded.noModelAvailable');
});
