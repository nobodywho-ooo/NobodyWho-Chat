import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { Alert, AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  createModelDownload,
  deleteModelDownload,
  getModelDownloads,
  updateModelDownloadParts,
  insertModel,
} from 'repositories';
import { Model, ModelDownload, ModelPart } from 'types';
import type { DiskSpaceCheck } from 'helpers';
import {
  checkDiskSpaceForModel,
  deleteModelDirectory,
  downloadModelPart,
  log,
  modelSizeLabel,
  NetworkError,
} from 'helpers';
import { selectModelIfSlotFree } from 'services';

const DOWNLOAD_THROTTLE = 0.01; // 1% step

// Live downloads keyed by model id, each with the AbortController that cancels
// its loop. Module-level (not state) so it survives remounts and so the
// resume effect and a user-initiated stop share the same map.
const activeDownloads = new Map<number, AbortController>();

// Ids of the running loops, replaced (never mutated) on each change so it can
// serve as the useActiveDownloadIds snapshot.
let activeDownloadIds: ReadonlySet<number> = new Set();
const activeDownloadsListeners = new Set<() => void>();

const setActiveDownload = (
  modelId: number,
  controller: AbortController | undefined,
) => {
  if (controller) {
    activeDownloads.set(modelId, controller);
  } else {
    activeDownloads.delete(modelId);
  }
  activeDownloadIds = new Set(activeDownloads.keys());
  activeDownloadsListeners.forEach(listener => listener());
};

const subscribeActiveDownloads = (listener: () => void) => {
  activeDownloadsListeners.add(listener);
  return () => {
    activeDownloadsListeners.delete(listener);
  };
};

// Models whose failure the user was already told about. Resume retries pending
// downloads on every return to the app, so one that keeps failing (offline)
// would otherwise alert again each time.
const reportedFailures = new Set<number>();

// Whether a download loop is running for the model right now.
export const isDownloadActive = (modelId: number): boolean =>
  activeDownloads.has(modelId);

// The models whose download loop is running, re-rendering when one starts or
// stops: a pending download that isn't in it is paused (it failed, or the app
// was closed mid-download).
export const useActiveDownloadIds = (): ReadonlySet<number> =>
  useSyncExternalStore(subscribeActiveDownloads, () => activeDownloadIds);

interface DownloadOptions {
  alertOnFailure?: boolean;
}

// The download loop shared by a fresh start and a resume.
const useRunDownload = () => {
  const { t } = useTranslation();

  return useCallback(
    async (
      download: ModelDownload,
      { alertOnFailure = true }: DownloadOptions = {},
    ) => {
      const { model } = download;

      if (activeDownloads.has(model.id)) {
        return;
      }

      const controller = new AbortController();
      setActiveDownload(model.id, controller);

      let modelDownloaded = false;

      try {
        const partsProgress = download.partsProgress.map(part => ({ ...part }));

        for (let i = 0; i < partsProgress.length; i++) {
          if (partsProgress[i].progress >= 1 && partsProgress[i].path) {
            continue;
          }

          const path = await downloadModelPart(
            model.id,
            partsProgress[i].url,
            partsProgress[i].fileName,
            controller.signal,
            (downloaded, total) => {
              const progress = total > 0 ? downloaded / total : 0;
              if (
                progress - partsProgress[i].progress >= DOWNLOAD_THROTTLE ||
                progress >= 1
              ) {
                partsProgress[i] = { ...partsProgress[i], progress };
                updateModelDownloadParts(model.id, partsProgress).catch(
                  error => {
                    log('runDownload updateModelDownloadParts', error);
                  },
                );
              }
            },
          );
          partsProgress[i] = { ...partsProgress[i], progress: 1, path };
          await updateModelDownloadParts(model.id, partsProgress);
        }

        if (controller.signal.aborted) {
          return;
        }

        const downloadedParts: ModelPart[] = partsProgress.map(
          ({ url, fileName, type, path, sizeGB }) => ({
            url,
            fileName,
            type,
            path,
            sizeGB,
          }),
        );

        try {
          await insertModel({ ...model, parts: downloadedParts });
        } catch (error) {
          await deleteModelDownload(model.id);
          deleteModelDirectory(model.id);
          throw error;
        }

        modelDownloaded = true;
        reportedFailures.delete(model.id);

        await selectModelIfSlotFree(model);

        await deleteModelDownload(model.id);
      } catch (error) {
        const capture =
          !controller.signal.aborted && !(error instanceof NetworkError);
        log('ModelsScreen runDownload', error, {
          // TODO: delete capture when model downloading is stable
          capture,
        });

        if (
          alertOnFailure &&
          !controller.signal.aborted &&
          !reportedFailures.has(model.id)
        ) {
          reportedFailures.add(model.id);
          Alert.alert(
            t('screens.models.downloadFailedTitle'),
            t('screens.models.downloadFailedModelMessage', {
              name: model.name,
            }),
          );
        }
      } finally {
        if (activeDownloads.get(model.id) === controller) {
          setActiveDownload(model.id, undefined);
        }

        if (controller.signal.aborted && !modelDownloaded) {
          deleteModelDirectory(model.id);
        }
      }
    },
    [t],
  );
};

// Restarts every download left pending in the database whose loop isn't
// running. `reportAgain` (the user asked for it) alerts on a failure even if
// that download's failure was already reported.
const useResumePendingDownloads = () => {
  const runDownload = useRunDownload();

  return useCallback(
    async ({ reportAgain = false }: { reportAgain?: boolean } = {}) => {
      try {
        const pendingDownloads = await getModelDownloads();
        for (const download of pendingDownloads) {
          if (!activeDownloads.has(download.model.id)) {
            if (reportAgain) {
              reportedFailures.delete(download.model.id);
            }
            runDownload(download);
          }
        }
      } catch (error) {
        log('resumePendingDownloads', error);
      }
    },
    [runDownload],
  );
};

// Resumes pending downloads at launch and on every return to the app.
export const useResumeModelDownloads = () => {
  const resumePendingDownloads = useResumePendingDownloads();

  useEffect(() => {
    resumePendingDownloads();

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        resumePendingDownloads();
      }
    });

    return () => subscription.remove();
  }, [resumePendingDownloads]);
};

export const useModelDownloader = () => {
  const { t } = useTranslation();
  const runDownload = useRunDownload();
  const resumePendingDownloads = useResumePendingDownloads();

  const resumeDownloads = useCallback(
    () => resumePendingDownloads({ reportAgain: true }),
    [resumePendingDownloads],
  );

  const warnNotEnoughSpace = useCallback(
    (models: readonly Model[], check: DiskSpaceCheck) =>
      Alert.alert(
        t('screens.models.notEnoughSpaceTitle'),
        t('screens.models.notEnoughSpaceMessage', {
          count: models.length,
          name: models[0].name,
          required: modelSizeLabel(check.requiredGB),
          available: modelSizeLabel(check.availableGB ?? 0),
        }),
      ),
    [t],
  );

  const startDownload = useCallback(
    async (model: Model, options?: DownloadOptions) => {
      const inProgress = await getModelDownloads().catch(error => {
        log('startDownload getModelDownloads', error);
        return [];
      });
      const spaceCheck = checkDiskSpaceForModel(model, inProgress);

      if (!spaceCheck.fits) {
        warnNotEnoughSpace([model], spaceCheck);
        return;
      }

      const created = await createModelDownload(model);
      if (!created) {
        return;
      }

      await runDownload(
        {
          model,
          partsProgress: model.parts.map(part => ({ ...part, progress: 0 })),
        },
        options,
      );
    },
    [runDownload, warnNotEnoughSpace],
  );

  const stopDownload = useCallback((model: Model) => {
    reportedFailures.delete(model.id);

    deleteModelDownload(model.id).catch(error =>
      log('ModelsScreen stopDownload', error),
    );

    const controller = activeDownloads.get(model.id);

    if (controller) {
      controller.abort();
    } else {
      deleteModelDirectory(model.id);
    }
  }, []);

  const promptStopDownload = useCallback(
    (model: Model) =>
      Alert.alert(
        t('screens.models.stopDownloadTitle'),
        t('screens.models.stopDownloadMessage'),
        [
          {
            text: t('screens.models.stopDownload'),
            style: 'destructive',
            onPress: () => stopDownload(model),
          },
          { text: t('common.cancel'), style: 'cancel' },
        ],
      ),
    [t, stopDownload],
  );

  return {
    startDownload,
    stopDownload,
    promptStopDownload,
    warnNotEnoughSpace,
    resumeDownloads,
  };
};
