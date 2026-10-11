import { useCallback } from 'react';
import {
  CURATED_VOICE_PIPELINE_MODELS,
  overallDownloadProgress,
  VOICE_MODELS_RESERVED_GB,
} from 'helpers';
import {
  useActiveDownloadIds,
  useCuratedModels,
  useModelDownloader,
} from 'hooks';

export interface VoiceModelDownloads {
  needsDownload: boolean;
  canDownload: boolean;
  isDownloading: boolean;
  isInterrupted: boolean;
  progress: number;
  downloadCurated: () => void;
  resume: () => void;
  cancel: () => void;
}

export const useVoiceModelDownloads = (): VoiceModelDownloads => {
  const {
    findCuratedToDownload,
    findModelsToDownload,
    findPendingDownloads,
    isCatalogueLoaded,
    isDownloading: isBatchDownloading,
    progress: batchProgress,
    downloadCurated,
    cancel: cancelBatch,
  } = useCuratedModels(undefined, VOICE_MODELS_RESERVED_GB);
  const { stopDownload, resumeDownloads } = useModelDownloader();
  const activeIds = useActiveDownloadIds();

  // Voice models on their way outside a batch of this screen: one it started
  // before being left and re-entered, or one interrupted by a failure.
  const pendingDownloads = findPendingDownloads(CURATED_VOICE_PIPELINE_MODELS);
  const isPendingActive = pendingDownloads.some(({ model }) =>
    activeIds.has(model.id),
  );

  const downloadCuratedVoiceModels = useCallback(() => {
    downloadCurated(CURATED_VOICE_PIPELINE_MODELS);
  }, [downloadCurated]);

  const cancel = useCallback(() => {
    if (isBatchDownloading) {
      cancelBatch();
      return;
    }

    pendingDownloads.forEach(({ model }) => stopDownload(model));
  }, [isBatchDownloading, cancelBatch, pendingDownloads, stopDownload]);

  return {
    needsDownload:
      findCuratedToDownload(CURATED_VOICE_PIPELINE_MODELS).length > 0,
    canDownload:
      !isCatalogueLoaded ||
      findModelsToDownload(CURATED_VOICE_PIPELINE_MODELS).length > 0,
    isDownloading: isBatchDownloading || isPendingActive,
    isInterrupted:
      !isBatchDownloading && !isPendingActive && pendingDownloads.length > 0,
    progress: isBatchDownloading
      ? batchProgress
      : overallDownloadProgress(pendingDownloads),
    downloadCurated: downloadCuratedVoiceModels,
    resume: resumeDownloads,
    cancel,
  };
};
