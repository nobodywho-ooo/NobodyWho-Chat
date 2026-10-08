import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useModelDownloads, useModels } from 'hooks';
import {
  checkDiskSpaceForModels,
  filterModelsByDeviceMemory,
  log,
  modelSizeLabel,
  MODELS_URL,
} from 'helpers';
import { getModelById, modelDownloadProgress } from 'repositories';
import {
  isChatPipeline,
  isSttPipeline,
  isTtsPipeline,
  isVadPipeline,
  Model,
  ModelPipeline,
} from 'types';
import { useModelDownloader } from './useModelDownloader';

const RECOMMENDED_TAG = 'Recommended';
const FIRST_PICK_TAG = 'Great First Pick';

// A pipeline the user needs, satisfied by any installed (or downloading) model
// that accepts it, or else by the catalogue model carrying `tag`.
export interface ModelRequirement {
  accepts: (pipeline: ModelPipeline) => boolean;
  tag: string;
}

export const TEXT_REQUIREMENTS: readonly ModelRequirement[] = [
  { accepts: isChatPipeline, tag: FIRST_PICK_TAG },
];

export const VOICE_REQUIREMENTS: readonly ModelRequirement[] = [
  ...TEXT_REQUIREMENTS,
  { accepts: isSttPipeline, tag: RECOMMENDED_TAG },
  { accepts: isTtsPipeline, tag: RECOMMENDED_TAG },
  { accepts: isVadPipeline, tag: RECOMMENDED_TAG },
];

export type DownloadOutcome =
  'done' | 'cancelled' | 'notEnoughSpace' | 'failed';

interface DownloadMissingOptions {
  alertOnFailure?: boolean;
}

const pickCatalogueModels = (
  requirements: readonly ModelRequirement[],
  catalogue: readonly Model[],
): Model[] =>
  requirements.flatMap(({ accepts, tag }) => {
    const model = catalogue.find(
      candidate => accepts(candidate.pipeline) && candidate.tags.includes(tag),
    );

    return model ? [model] : [];
  });

export interface MissingModelDownloads {
  findMissingRequirements: (
    requirements: readonly ModelRequirement[],
  ) => readonly ModelRequirement[];
  findMissingModels: (requirements: readonly ModelRequirement[]) => Model[];
  isDownloading: boolean;
  progress: number;
  downloadMissing: (
    requirements: readonly ModelRequirement[],
    options?: DownloadMissingOptions,
  ) => Promise<DownloadOutcome>;
  cancel: () => void;
}

export const useMissingModelDownloads = (): MissingModelDownloads => {
  const { t } = useTranslation();
  const { models: storedModels } = useModels();
  const { downloads } = useModelDownloads();
  const { startDownload, stopDownload } = useModelDownloader();

  const [catalogue, setCatalogue] = useState<Model[]>([]);

  // The models the user asked for in this session, kept so progress can still
  // count a model whose download row has already gone (it finished).
  const [targets, setTargets] = useState<Model[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);

  // Bumped by every downloadMissing/cancel so a batch settling after the user
  // cancelled (or started another one) can't reset the newer state.
  const batchRef = useRef(0);
  // cancel() may run from an awaited callback; read the latest values.
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const storedModelsRef = useRef(storedModels);
  storedModelsRef.current = storedModels;

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // The in-flight or settled fetch, shared by the mount-time load and
  // downloadMissing. Cleared on failure so the next download retries it (the
  // device may have come back online since).
  const cataloguePromise = useRef<Promise<Model[]> | undefined>(undefined);
  const loadCatalogue = useCallback(() => {
    if (cataloguePromise.current === undefined) {
      const promise = (async () => {
        const response = await fetch(MODELS_URL);
        const data: Model[] = await response.json();
        return filterModelsByDeviceMemory(data);
      })();
      cataloguePromise.current = promise;

      promise.then(
        models => {
          if (isMounted.current) {
            setCatalogue(models);
          }
        },
        error => {
          if (cataloguePromise.current === promise) {
            cataloguePromise.current = undefined;
          }
          log('useMissingModelDownloads fetchCatalogue', error);
        },
      );
    }
    return cataloguePromise.current;
  }, []);

  useEffect(() => {
    // Failure is already logged; downloadMissing retries.
    loadCatalogue().catch(() => {});
  }, [loadCatalogue]);

  const findMissingRequirements = useCallback(
    (requirements: readonly ModelRequirement[]) =>
      requirements.filter(
        ({ accepts }) =>
          !storedModels.some(model => accepts(model.pipeline)) &&
          !downloads.some(download => accepts(download.model.pipeline)),
      ),
    [storedModels, downloads],
  );

  const findMissingModels = useCallback(
    (requirements: readonly ModelRequirement[]) =>
      pickCatalogueModels(findMissingRequirements(requirements), catalogue),
    [findMissingRequirements, catalogue],
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

  const downloadMissing = useCallback(
    async (
      requirements: readonly ModelRequirement[],
      { alertOnFailure = true }: DownloadMissingOptions = {},
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

      const missingRequirements = findMissingRequirements(requirements);
      if (missingRequirements.length === 0) {
        return 'done';
      }

      // Shows progress while a catalogue that never loaded (offline at mount)
      // is fetched again, and lets the user cancel that wait.
      const batch = ++batchRef.current;
      setIsDownloading(true);

      let missingModels: Model[] = [];
      try {
        missingModels = pickCatalogueModels(
          missingRequirements,
          await loadCatalogue(),
        );
      } catch {
        // Logged by loadCatalogue; reported as a failure below.
      }

      if (batch !== batchRef.current) {
        return 'cancelled';
      }
      if (missingModels.length === 0) {
        batchRef.current++;
        if (isMounted.current) {
          setIsDownloading(false);
        }
        return fail();
      }

      // Checked for the whole batch up front, so a set that doesn't fit is
      // refused with one alert instead of starting the models that do.
      const spaceCheck = checkDiskSpaceForModels(missingModels);
      if (!spaceCheck.fits) {
        const [model] = missingModels;
        Alert.alert(
          t('screens.models.notEnoughSpaceTitle'),
          missingModels.length === 1
            ? t('screens.models.notEnoughSpaceMessage', {
                name: model.name,
                required: modelSizeLabel(spaceCheck.requiredGB),
                available: modelSizeLabel(spaceCheck.availableGB ?? 0),
              })
            : t('screens.models.notEnoughSpaceMessageMultiple', {
                required: modelSizeLabel(spaceCheck.requiredGB),
                available: modelSizeLabel(spaceCheck.availableGB ?? 0),
              }),
        );
        batchRef.current++;
        if (isMounted.current) {
          setIsDownloading(false);
        }
        return 'notEnoughSpace';
      }

      setTargets(missingModels);

      // Until read back from the database, assume whatever isn't known to be
      // stored is what failed.
      let failedModels = missingModels.filter(
        model =>
          !storedModelsRef.current.some(stored => stored.id === model.id),
      );
      try {
        // startDownload swallows download errors (and resolves early on a
        // disk-space refusal), so success is read back from the database.
        // Per-model failure alerts off: the batch reports once, below.
        await Promise.all(
          missingModels.map(model =>
            startDownload(model, { alertOnFailure: false }),
          ),
        );
        const stored = await Promise.all(
          missingModels.map(model => getModelById(model.id)),
        );
        failedModels = missingModels.filter((_, i) => stored[i] === undefined);
      } catch (error) {
        log('useMissingModelDownloads downloadMissing', error);
      }

      if (batch !== batchRef.current) {
        return 'cancelled';
      }
      batchRef.current++;
      if (isMounted.current) {
        setTargets([]);
        setIsDownloading(false);
      }

      if (failedModels.length === 0) {
        return 'done';
      }

      // Drop the half-finished downloads so the user can simply retry. Only the
      // failed ones: the models that did land stay installed.
      failedModels.forEach(stopDownload);
      return fail();
    },
    [findMissingRequirements, loadCatalogue, startDownload, stopDownload, t],
  );

  const cancel = useCallback(() => {
    batchRef.current++;
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
    findMissingRequirements,
    findMissingModels,
    isDownloading,
    progress,
    downloadMissing,
    cancel,
  };
};
