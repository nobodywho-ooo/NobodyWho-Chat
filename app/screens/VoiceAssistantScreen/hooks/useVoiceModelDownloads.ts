import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useModelDownloads, useModels } from 'hooks';
import { filterModelsByDeviceMemory, log, MODELS_URL } from 'helpers';
import { modelDownloadProgress } from 'repositories';
import { Model, ModelPipeline } from 'types';
import { useModelDownloader } from '../../ModelsScreen/useModelDownloader';

const RECOMMENDED_TAG = 'Recommended';

const VOICE_PIPELINES: readonly ModelPipeline[] = [
  ModelPipeline.speechToText,
  ModelPipeline.textToSpeech,
  ModelPipeline.voiceActivityDetection,
];

export interface VoiceModelDownloads {
  hasMissingModels: boolean;
  canDownload: boolean;
  isDownloading: boolean;
  progress: number;
  downloadMissing: () => void;
  cancel: () => void;
}

export const useVoiceModelDownloads = (): VoiceModelDownloads => {
  const { models: storedModels } = useModels();
  const { downloads } = useModelDownloads();
  const { startDownload, stopDownload } = useModelDownloader();

  const [catalogue, setCatalogue] = useState<Model[]>([]);

  // The models the user asked for in this session, kept so progress can still
  // count a model whose download row has already gone (it finished).
  const [targets, setTargets] = useState<Model[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchCatalogue = async () => {
      try {
        const response = await fetch(MODELS_URL);
        const data: Model[] = await response.json();
        const models = await filterModelsByDeviceMemory(data);
        if (isMounted.current) {
          setCatalogue(models);
        }
      } catch (error) {
        log('useVoiceModelDownloads fetchCatalogue', error);
      }
    };

    fetchCatalogue();
  }, []);

  const missingPipelines = useMemo(
    () =>
      VOICE_PIPELINES.filter(
        pipeline =>
          !storedModels.some(model => model.pipeline === pipeline) &&
          !downloads.some(download => download.model.pipeline === pipeline),
      ),
    [storedModels, downloads],
  );

  const missingModels = useMemo(
    () =>
      missingPipelines.flatMap(pipeline => {
        const model = catalogue.find(
          candidate =>
            candidate.pipeline === pipeline &&
            candidate.tags.includes(RECOMMENDED_TAG),
        );

        return model ? [model] : [];
      }),
    [missingPipelines, catalogue],
  );

  const progress = useMemo(() => {
    const totalGB = targets.reduce((sum, model) => sum + model.sizeGB, 0);
    if (totalGB <= 0) {
      return 0;
    }

    const downloadedGB = targets.reduce((sum, model) => {
      const download = downloads.find(entry => entry.model.id === model.id);
      if (download) {
        return sum + modelDownloadProgress(download) * model.sizeGB;
      }

      const isStored = storedModels.some(stored => stored.id === model.id);
      return isStored ? sum + model.sizeGB : sum;
    }, 0);

    return downloadedGB / totalGB;
  }, [targets, downloads, storedModels]);

  const downloadMissing = useCallback(() => {
    if (missingModels.length === 0) {
      return;
    }

    setTargets(missingModels);
    setIsDownloading(true);

    Promise.all(missingModels.map(model => startDownload(model)))
      .catch(error => log('useVoiceModelDownloads downloadMissing', error))
      .finally(() => {
        if (isMounted.current) {
          setIsDownloading(false);
        }
      });
  }, [missingModels, startDownload]);

  const cancel = useCallback(() => {
    // Only the ones still in flight: stopping a model that already landed would
    // take the "no live download" branch in stopDownload and delete the files
    // of a model that is now installed (and possibly selected into its slot).
    targets
      .filter(target => !storedModels.some(stored => stored.id === target.id))
      .forEach(stopDownload);
    setTargets([]);
    setIsDownloading(false);
  }, [targets, storedModels, stopDownload]);

  return {
    hasMissingModels: missingPipelines.length > 0,
    canDownload: missingModels.length > 0,
    isDownloading,
    progress,
    downloadMissing,
    cancel,
  };
};
