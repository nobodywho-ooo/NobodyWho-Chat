import { useCallback, useEffect, useMemo, useState } from 'react';
import { map, prop } from 'ramda';
import { useAppState, useModelDownloads, useModels } from 'hooks';
import { fitsInDeviceMemory, log } from 'helpers';
import {
  getModelCatalogue,
  refreshModelCatalogue,
  useModelCatalogue,
} from 'services';
import { MODEL_SLOTS } from 'types';

// Reads the shared catalogue cache, filters it to what the device can run, and
// derives the lists the screen renders: the models in use (one per occupied
// slot) and which remain available (not already downloaded or downloading).
export const useAvailableModels = () => {
  const { models: storedModels } = useModels();
  const { downloads } = useModelDownloads();
  const appState = useAppState();
  const [hasRequested, setHasRequested] = useState(false);
  const { catalogue, isFetching, hasFailed } = useModelCatalogue();

  // Serves the cache (refreshing it behind the scenes once stale), or fetches.
  useEffect(() => {
    setHasRequested(true);
    getModelCatalogue().catch(error =>
      log('useAvailableModels getModelCatalogue', error),
    );
  }, []);

  const refetch = useCallback(() => {
    refreshModelCatalogue().catch(error =>
      log('useAvailableModels refreshModelCatalogue', error),
    );
  }, []);

  const hasError =
    catalogue === undefined && hasRequested && hasFailed && !isFetching;
  const isLoading = catalogue === undefined && !hasError;
  const hasFetched = catalogue !== undefined || hasError;

  const models = useMemo(
    () =>
      catalogue === undefined
        ? []
        : catalogue.models.filter(model =>
            fitsInDeviceMemory([model], catalogue.ramGB),
          ),
    [catalogue],
  );

  const downloadedModelIds = useMemo(
    () => map(prop('id'), storedModels),
    [storedModels],
  );

  const downloadingKey = downloads.map(download => download.model.id).join(',');
  const downloadingModelIds = useMemo(
    () => (downloadingKey === '' ? [] : downloadingKey.split(',').map(Number)),
    [downloadingKey],
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

  const inUseModels = useMemo(
    () =>
      MODEL_SLOTS.flatMap(({ appStateKey }) => {
        const model = storedModels.find(
          candidate => candidate.id === appState[appStateKey],
        );
        return model ? [model] : [];
      }),
    [storedModels, appState],
  );

  return {
    downloads,
    availableModels,
    inUseModels,
    isLoading,
    hasError,
    hasFetched,
    refetch,
  };
};
