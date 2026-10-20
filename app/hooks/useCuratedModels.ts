import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  checkDiskSpaceForModels,
  CuratedModel,
  CuratedAvailability,
  DeviceCatalogue,
  fetchDeviceCatalogue,
  log,
  modelDownloadProgress,
  curatedAvailability,
  sizeWeightedProgress,
} from 'helpers';
import { getModelById } from 'repositories';
import { MODEL_SLOTS, Model } from 'types';
import { useAppState } from './useAppState';
import { isDownloadActive, useModelDownloader } from './useModelDownloader';
import { useModelDownloads } from './useModelDownloads';
import { useModels } from './useModels';

export type DownloadOutcome =
  'done' | 'inProgress' | 'cancelled' | 'notEnoughSpace' | 'failed';

interface DownloadCuratedOptions {
  alertOnFailure?: boolean;
}

export interface CuratedModels {
  availabilityOf: (curated: readonly CuratedModel[]) => CuratedAvailability;
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
  initialCatalogue?: DeviceCatalogue,
): CuratedModels => {
  const { t } = useTranslation();
  const appState = useAppState();
  const { models: storedModels, loading: isModelsLoading } = useModels();
  const { downloads, loading: isDownloadsLoading } = useModelDownloads();
  const { startDownload, stopDownload, warnNotEnoughSpace } =
    useModelDownloader();

  const [catalogue, setCatalogue] = useState<
    DeviceCatalogue | 'loading' | 'failed'
  >(initialCatalogue ?? 'loading');

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

  const hasInitialCatalogue = initialCatalogue !== undefined;

  useEffect(() => {
    if (hasInitialCatalogue) {
      return;
    }

    let isMounted = true;

    fetchDeviceCatalogue().then(
      loaded => {
        if (isMounted) {
          setCatalogue(loaded);
        }
      },
      error => {
        log('useCuratedModels fetchDeviceCatalogue', error);
        if (isMounted) {
          setCatalogue('failed');
        }
      },
    );

    return () => {
      isMounted = false;
    };
  }, [hasInitialCatalogue]);

  const isLoaded = !isModelsLoading && !isDownloadsLoading;

  const inUseIds = useMemo(
    () =>
      MODEL_SLOTS.flatMap(({ appStateKey }) => {
        const id = appState[appStateKey];
        return id === undefined ? [] : [id];
      }),
    [appState],
  );

  const availabilityOf = useCallback(
    (curated: readonly CuratedModel[]): CuratedAvailability =>
      isLoaded
        ? curatedAvailability(curated, {
            installed: storedModels,
            downloads,
            inUseIds,
            catalogue,
          })
        : { kind: 'loading' },
    [isLoaded, storedModels, downloads, inUseIds, catalogue],
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

      const availability = availabilityOf(curated);

      if (availability.kind === 'ready') {
        return 'done';
      }

      if (availability.kind === 'inProgress') {
        return 'inProgress';
      }

      if (availability.kind !== 'automatic') {
        return fail();
      }

      const modelsToDownload = availability.models;

      const spaceCheck = checkDiskSpaceForModels(modelsToDownload, downloads);

      if (!spaceCheck.fits) {
        warnNotEnoughSpace(modelsToDownload, spaceCheck);

        return 'notEnoughSpace';
      }

      const batch = ++batchRef.current;
      const batchAbort = new AbortController();
      batchAbortRef.current = batchAbort;
      setTargets([...modelsToDownload]);
      setIsDownloading(true);

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

      setTargets([]);
      setIsDownloading(false);

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
    [availabilityOf, downloads, startDownload, warnNotEnoughSpace, t],
  );

  // Only the ones not installed
  const cancel = useCallback(() => {
    batchRef.current++;
    batchAbortRef.current?.abort();
    targetsRef.current.forEach(target => {
      if (isDownloadActive(target.id)) {
        stopDownload(target);
        return;
      }

      getModelById(target.id)
        .then(stored => {
          if (stored === undefined) {
            stopDownload(target);
          }
        })
        .catch(error => log('useCuratedModels cancel', error));
    });
    setTargets([]);
    setIsDownloading(false);
  }, [stopDownload]);

  return useMemo(
    () => ({
      availabilityOf,
      isLoaded,
      isDownloading,
      progress,
      downloadCurated,
      cancel,
    }),
    [
      availabilityOf,
      isLoaded,
      isDownloading,
      progress,
      downloadCurated,
      cancel,
    ],
  );
};
