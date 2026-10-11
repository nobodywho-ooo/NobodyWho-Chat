import { useCallback } from 'react';
import {
  CURATED_VOICE_PIPELINE_MODELS,
  VOICE_MODELS_RESERVED_GB,
} from 'helpers';
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
    isCatalogueLoaded,
    isDownloading,
    progress,
    downloadCurated,
    cancel,
  } = useCuratedModels(undefined, VOICE_MODELS_RESERVED_GB);

  const downloadCuratedVoiceModels = useCallback(() => {
    downloadCurated(CURATED_VOICE_PIPELINE_MODELS);
  }, [downloadCurated]);

  return {
    needsDownload:
      findCuratedToDownload(CURATED_VOICE_PIPELINE_MODELS).length > 0,
    canDownload:
      !isCatalogueLoaded ||
      findModelsToDownload(CURATED_VOICE_PIPELINE_MODELS).length > 0,
    isDownloading,
    progress,
    downloadCurated: downloadCuratedVoiceModels,
    cancel,
  };
};
