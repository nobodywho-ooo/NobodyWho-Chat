import { useCallback, useEffect, useMemo, useState } from 'react';
import { find, map, pathEq, prop } from 'ramda';
import { useAppState, useModelDownloads, useModels } from 'hooks';
import { filterModelsByDeviceMemory } from 'helpers';
import { Model } from 'types';

const MODELS_URL =
  'https://raw.githubusercontent.com/pielouNW/mobile-backend/refs/heads/main/v1/v1.1.0.json';

// Fetches the catalogue, filters it to what the device can run, and derives the
// three lists the screen renders: the model in use, how many are downloaded,
// and which remain available (not already downloaded or downloading).
export const useAvailableModels = () => {
  const { models: storedModels } = useModels();
  const { downloads } = useModelDownloads();
  const { modelIdInUse, ttsModelIdInUse, sttModelIdInUse, vadModelIdInUse } =
    useAppState();

  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const response = await fetch(MODELS_URL);
      const data: Model[] = await response.json();
      setModels(await filterModelsByDeviceMemory(data));
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const downloadedModelIds = useMemo(
    () => map(prop('id'), storedModels),
    [storedModels],
  );

  const downloadingModelIds = useMemo(
    () => downloads.map(download => download.model.id),
    [downloads],
  );

  const availableModels = useMemo(
    () =>
      models.filter(
        model =>
          !downloadedModelIds.includes(model.id) &&
          !downloadingModelIds.includes(model.id),
      ),
    [models, downloadedModelIds, downloadingModelIds],
  );

  const currentModel = useMemo(
    () => find(pathEq(modelIdInUse, ['id']), storedModels),
    [modelIdInUse, storedModels],
  );

  const currentTtsModel = useMemo(
    () => find(pathEq(ttsModelIdInUse, ['id']), storedModels),
    [ttsModelIdInUse, storedModels],
  );

  const currentSttModel = useMemo(
    () => find(pathEq(sttModelIdInUse, ['id']), storedModels),
    [sttModelIdInUse, storedModels],
  );

  const currentVadModel = useMemo(
    () => find(pathEq(vadModelIdInUse, ['id']), storedModels),
    [vadModelIdInUse, storedModels],
  );

  return {
    availableModels,
    currentModel,
    currentTtsModel,
    currentSttModel,
    currentVadModel,
    downloadedCount: downloadedModelIds.length,
    isLoading,
    hasError,
    hasFetched,
    refetch: fetchModels,
  };
};
