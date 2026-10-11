import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  checkDiskSpaceForModels,
  CuratedModel,
  fetchModelCatalogue,
  fulfills,
  log,
  modelDownloadProgress,
  resolveCuratedModels,
  sizeWeightedProgress,
} from 'helpers';
import { getModelById } from 'repositories';
import { Model, ModelDownload } from 'types';
import { isDownloadActive, useModelDownloader } from './useModelDownloader';
import { useModelDownloads } from './useModelDownloads';
import { useModels } from './useModels';

export type DownloadOutcome =
  'done' | 'inProgress' | 'cancelled' | 'notEnoughSpace' | 'failed';

interface DownloadCuratedOptions {
  alertOnFailure?: boolean;
}

export interface CuratedModels {
  findCuratedToDownload: (
    curated: readonly CuratedModel[],
  ) => readonly CuratedModel[];
  findModelsToDownload: (curated: readonly CuratedModel[]) => Model[];
  findPendingDownloads: (
    curated: readonly CuratedModel[],
  ) => readonly ModelDownload[];
  isCatalogueLoaded: boolean;
  isLoaded: boolean;
  isDownloading: boolean;
  progress: number;
  downloadCurated: (
    curated: readonly CuratedModel[],
    options?: DownloadCuratedOptions,
  ) => Promise<DownloadOutcome>;
  cancel: () => void;
}

export const useCuratedModels = (
  initialCatalogue?: Model[],
  reservedGB = 0,
): CuratedModels => {
  const { t } = useTranslation();
  const { models: storedModels, loading: isModelsLoading } = useModels();
  const { downloads, loading: isDownloadsLoading } = useModelDownloads();
  const { startDownload, stopDownload, warnNotEnoughSpace } =
    useModelDownloader();

  const [catalogue, setCatalogue] = useState<Model[]>(initialCatalogue ?? []);

  // The models the user asked for in this session, kept so progress can still
  // count a model whose download row has already gone (it finished).
  const [targets, setTargets] = useState<Model[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);

  // Bumped by every downloadCurated/cancel so a batch settling after the user
  // cancelled (or started another one) can't reset the newer state.
  const batchRef = useRef(0);
  // Aborted by cancel() so a download not started yet never starts.
  const batchAbortRef = useRef<AbortController | undefined>(undefined);
  // cancel() may run from an awaited callback; read the latest values.
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const storedModelsRef = useRef(storedModels);
  storedModelsRef.current = storedModels;

  // The in-flight or settled fetch, shared by the mount-time load and
  // downloadCurated. Cleared on failure so the next download retries it (the
  // device may have come back online since).
  const cataloguePromise = useRef<Promise<Model[]> | undefined>(
    initialCatalogue && Promise.resolve(initialCatalogue),
  );
  const loadCatalogue = useCallback(() => {
    if (cataloguePromise.current === undefined) {
      const promise = fetchModelCatalogue(reservedGB);
      cataloguePromise.current = promise;

      promise.then(
        models => setCatalogue(models),
        error => {
          if (cataloguePromise.current === promise) {
            cataloguePromise.current = undefined;
          }
          log('useCuratedModels fetchCatalogue', error);
        },
      );
    }
    return cataloguePromise.current;
  }, [reservedGB]);

  useEffect(() => {
    loadCatalogue().catch(() => {});
  }, [loadCatalogue]);

  const findCuratedToDownload = useCallback(
    (curated: readonly CuratedModel[]) =>
      curated.filter(
        entry =>
          !storedModels.some(model => fulfills(model, entry)) &&
          !downloads.some(download => fulfills(download.model, entry)),
      ),
    [storedModels, downloads],
  );

  const findModelsToDownload = useCallback(
    (curated: readonly CuratedModel[]) =>
      resolveCuratedModels(findCuratedToDownload(curated), catalogue),
    [findCuratedToDownload, catalogue],
  );

  const findPendingDownloads = useCallback(
    (curated: readonly CuratedModel[]) =>
      downloads.filter(download =>
        curated.some(
          entry =>
            fulfills(download.model, entry) &&
            !storedModels.some(model => fulfills(model, entry)),
        ),
      ),
    [storedModels, downloads],
  );

  const progress = useMemo(
    () =>
      sizeWeightedProgress(
        targets.map(model => {
          const download = downloads.find(entry => entry.model.id === model.id);

          if (download) {
            return { model, progress: modelDownloadProgress(download) };
          }

          const isStored = storedModels.some(stored => stored.id === model.id);

          return { model, progress: isStored ? 1 : 0 };
        }),
      ),
    [targets, downloads, storedModels],
  );

  const downloadCurated = useCallback(
    async (
      curated: readonly CuratedModel[],
      { alertOnFailure = true }: DownloadCuratedOptions = {},
    ): Promise<DownloadOutcome> => {
      const fail = (): DownloadOutcome => {
        if (alertOnFailure) {
          Alert.alert(
            t('screens.models.downloadFailedTitle'),
            t('screens.models.downloadFailedMessage'),
          );
        }

        return 'failed';
      };

      const curatedToDownload = findCuratedToDownload(curated);

      if (curatedToDownload.length === 0) {
        // Some may only be covered by a download still on its way.
        const isInstalled = curated.every(entry =>
          storedModels.some(model => fulfills(model, entry)),
        );

        return isInstalled ? 'done' : 'inProgress';
      }

      const endBatch = () => {
        setTargets([]);
        setIsDownloading(false);
      };

      // Shows progress while a catalogue that never loaded (offline at mount)
      // is fetched again, and lets the user cancel that wait.
      const batch = ++batchRef.current;
      const batchAbort = new AbortController();
      batchAbortRef.current = batchAbort;
      setIsDownloading(true);

      let modelsToDownload: Model[] = [];

      try {
        modelsToDownload = resolveCuratedModels(
          curatedToDownload,
          await loadCatalogue(),
        );
      } catch {}

      if (batch !== batchRef.current) {
        return 'cancelled';
      }

      if (
        modelsToDownload.length === 0 ||
        modelsToDownload.length < curatedToDownload.length
      ) {
        endBatch();
        return fail();
      }

      // Checked for the whole batch up front
      const spaceCheck = checkDiskSpaceForModels(modelsToDownload, downloads);

      if (!spaceCheck.fits) {
        warnNotEnoughSpace(modelsToDownload, spaceCheck);
        endBatch();

        return 'notEnoughSpace';
      }

      setTargets(modelsToDownload);

      // Stays undefined if that fails, so nothing is cleaned up on a guess
      let failedModels: Model[] | undefined;

      try {
        await Promise.all(
          modelsToDownload.map(model =>
            startDownload(model, {
              alertOnFailure: false,
              signal: batchAbort.signal,
              skipSpaceCheck: true,
            }),
          ),
        );

        const stored = await Promise.all(
          modelsToDownload.map(model => getModelById(model.id)),
        );

        failedModels = modelsToDownload.filter(
          (_, i) => stored[i] === undefined,
        );
      } catch (error) {
        log('useCuratedModels downloadCurated', error);
      }

      if (batch !== batchRef.current) {
        return 'cancelled';
      }

      endBatch();

      if (failedModels?.length === 0) {
        return 'done';
      }

      const stillFailed = failedModels?.filter(
        model => !isDownloadActive(model.id),
      );

      if (stillFailed?.length === 0) {
        return 'inProgress';
      }

      return fail();
    },
    [
      downloads,
      storedModels,
      findCuratedToDownload,
      loadCatalogue,
      startDownload,
      warnNotEnoughSpace,
      t,
    ],
  );

  const cancel = useCallback(() => {
    batchRef.current++;
    batchAbortRef.current?.abort();
    // Only the ones still in flight: stopping a model that already landed would
    // take the "no live download" branch in stopDownload and delete the files
    // of a model that is now installed (and possibly selected into its slot).
    targetsRef.current
      .filter(
        target =>
          !storedModelsRef.current.some(stored => stored.id === target.id),
      )
      .forEach(stopDownload);
    setTargets([]);
    setIsDownloading(false);
  }, [stopDownload]);

  return {
    findCuratedToDownload,
    findModelsToDownload,
    findPendingDownloads,
    isCatalogueLoaded: catalogue.length > 0,
    isLoaded: !isModelsLoading && !isDownloadsLoading,
    isDownloading,
    progress,
    downloadCurated,
    cancel,
  };
};
