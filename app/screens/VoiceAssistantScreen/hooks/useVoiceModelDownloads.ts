import { useCallback } from 'react';
import {
  CURATED_VOICE_PIPELINE_MODELS,
  overallDownloadProgress,
} from 'helpers';
import {
  useActiveDownloadIds,
  useCuratedModels,
  useModelDownloader,
} from 'hooks';
import { ModelDownload } from 'types';

export type VoiceSetupState =
  'loading' | 'ready' | 'automatic' | 'manual' | 'downloading' | 'interrupted';

export interface VoiceModelDownloads {
  state: VoiceSetupState;
  progress: number;
  download: () => void;
  resume: () => void;
  cancel: () => void;
}

const NO_DOWNLOADS: readonly ModelDownload[] = [];

export const useVoiceModelDownloads = (): VoiceModelDownloads => {
  const {
    availabilityOf,
    isDownloading: isBatchDownloading,
    progress: batchProgress,
    downloadCurated,
    cancel: cancelBatch,
  } = useCuratedModels(undefined, CURATED_VOICE_PIPELINE_MODELS);
  const { promptStopDownloads, resumeDownloads } = useModelDownloader();
  const activeIds = useActiveDownloadIds();

  const voiceAvailability = availabilityOf(CURATED_VOICE_PIPELINE_MODELS);

  // Voice models on their way outside a batch of this screen: one it started
  // before being left and re-entered, or one interrupted by a failure.
  const pendingDownloads =
    voiceAvailability.kind === 'inProgress'
      ? voiceAvailability.downloads
      : NO_DOWNLOADS;
  const isPendingActive = pendingDownloads.some(({ model }) =>
    activeIds.has(model.id),
  );

  const download = useCallback(() => {
    downloadCurated(CURATED_VOICE_PIPELINE_MODELS);
  }, [downloadCurated]);

  const cancel = useCallback(() => {
    if (isBatchDownloading) {
      cancelBatch();
      return;
    }

    promptStopDownloads(pendingDownloads.map(({ model }) => model));
  }, [isBatchDownloading, cancelBatch, pendingDownloads, promptStopDownloads]);

  const state = ((): VoiceSetupState => {
    if (isBatchDownloading || isPendingActive) {
      return 'downloading';
    }

    return voiceAvailability.kind === 'inProgress'
      ? 'interrupted'
      : voiceAvailability.kind;
  })();

  return {
    state,
    progress: isBatchDownloading
      ? batchProgress
      : overallDownloadProgress(pendingDownloads),
    download,
    resume: resumeDownloads,
    cancel,
  };
};
