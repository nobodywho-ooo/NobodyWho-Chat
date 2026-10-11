import { useCallback } from 'react';
import { CURATED_VOICE_PIPELINE_MODELS } from 'helpers';
import { useCuratedModels } from 'hooks';

export interface VoiceModelDownloads {
  needsDownload: boolean;
  canDownload: boolean;
  isDownloading: boolean;
  progress: number;
  downloadCurated: () => void;
  cancel: () => void;
}

export const useVoiceModelDownloads = (): VoiceModelDownloads => {
  const {
    findCuratedToDownload,
    findModelsToDownload,
    isDownloading,
    progress,
    downloadCurated,
    cancel,
  } = useCuratedModels();

  const downloadCuratedVoiceModels = useCallback(() => {
    downloadCurated(CURATED_VOICE_PIPELINE_MODELS);
  }, [downloadCurated]);

  return {
    needsDownload:
      findCuratedToDownload(CURATED_VOICE_PIPELINE_MODELS).length > 0,
    canDownload: findModelsToDownload(CURATED_VOICE_PIPELINE_MODELS).length > 0,
    isDownloading,
    progress,
    downloadCurated: downloadCuratedVoiceModels,
    cancel,
  };
};
