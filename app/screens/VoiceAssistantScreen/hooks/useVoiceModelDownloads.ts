import { useCallback } from 'react';
import {
  useMissingModelDownloads,
  VOICE_REQUIREMENTS,
} from '../../ModelsScreen/useMissingModelDownloads';

export interface VoiceModelDownloads {
  hasMissingModels: boolean;
  canDownload: boolean;
  isDownloading: boolean;
  progress: number;
  downloadMissing: () => void;
  cancel: () => void;
}

export const useVoiceModelDownloads = (): VoiceModelDownloads => {
  const {
    findMissingRequirements,
    findMissingModels,
    isDownloading,
    progress,
    downloadMissing,
    cancel,
  } = useMissingModelDownloads();

  const downloadMissingVoiceModels = useCallback(() => {
    downloadMissing(VOICE_REQUIREMENTS);
  }, [downloadMissing]);

  return {
    hasMissingModels: findMissingRequirements(VOICE_REQUIREMENTS).length > 0,
    canDownload: findMissingModels(VOICE_REQUIREMENTS).length > 0,
    isDownloading,
    progress,
    downloadMissing: downloadMissingVoiceModels,
    cancel,
  };
};
