import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { Alert, AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  createModelDownload,
  deleteModelDownload,
  getModelDownloads,
  updateModelDownloadParts,
  insertModel,
} from 'repositories';
import {
  Model,
  ModelDownload,
  ModelDownloadPart,
  ModelPart,
  ModelSlot,
  slotForPipeline,
} from 'types';
import type { DiskSpaceCheck } from 'helpers';
import {
  checkDiskSpaceForModel,
  deleteModelDirectory,
  downloadModelPart,
  isPermanentDownloadFailure,
  log,
  modelSizeLabel,
  stopModelTransfers,
} from 'helpers';
import {
  cachedCatalogueModel,
  endOrphanDownloadActivities,
  finishDownloadActivity,
  notifyChatModelArrival,
  reportDownloadActivity,
  selectModelIfSlotFree,
} from 'services';

const DOWNLOAD_THROTTLE = 0.01; // 1% step

// Waits before each automatic retry of a part that failed while the app is in the foreground.
export const RETRY_DELAYS_MS = [2_000, 10_000, 30_000];

// Hard cap on the transfers of one part in one run of the loop, whatever the
// retry policy says: it resets its counts on each return to the app, so a part
// that keeps failing across trips would otherwise be retried forever. Past it
// the part fails; the download stays pending and the next return to the app
// starts a new run.
export const MAX_PART_ATTEMPTS = 10;

const activeDownloads = new Map<number, AbortController>();

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

// False until the launch resume has restarted the pending downloads
let hasResumedAtLaunch = false;

// Resolves once the model has no stopped loop still winding down.
const whenStoppedDownloadEnded = (modelId: number) =>
  new Promise<void>(resolve => {
    const check = () => {
      if (!activeDownloads.get(modelId)?.signal.aborted) {
        unsubscribe();
        resolve();
      }
    };
    const unsubscribe = subscribeActiveDownloads(check);
    check();
  });

let isInForeground = AppState.currentState !== 'background';

const foregroundWaiters = new Set<() => void>();

const whenInForeground = (signal: AbortSignal) =>
  new Promise<void>(resolve => {
    if (isInForeground || signal.aborted) {
      resolve();
      return;
    }

    const release = () => {
      foregroundWaiters.delete(release);
      signal.removeEventListener('abort', release);
      resolve();
    };

    foregroundWaiters.add(release);
    signal.addEventListener('abort', release);
  });

// Resolves after `ms`, or as soon as the download is stopped.
const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>(resolve => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };

    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done);
  });

interface PartRetryCallbacks {
  onWaiting: () => void;
  onResumed: () => void;
}

// Decides, after a part's transfer failed, whether to try it again, and waits
// as long as needed before saying yes. One policy per part: it counts that
// part's retries.
// - stopped: never;
// - refused (see isPermanentDownloadFailure): once, if it had received bytes —
//   likely the signed CDN address a resumed transfer kept has expired, and a
//   fresh request goes through the catalogue URL again;
// - in the background: once right away (the OS takes the new transfer), then
//   after the app is back in the foreground, with the counts reset;
// - in the foreground: after each of RETRY_DELAYS_MS if it had received bytes;
//   a part that never got a byte (offline, wrong URL) is reported at once.
export const createPartRetryPolicy = (
  signal: AbortSignal,
  { onWaiting, onResumed }: PartRetryCallbacks,
) => {
  let retries = 0;
  let retriedInBackground = false;
  let retriedAfterRefusal = false;

  return async (error: unknown, received: boolean): Promise<boolean> => {
    if (signal.aborted) {
      return false;
    }

    if (isPermanentDownloadFailure(error)) {
      if (!received || retriedAfterRefusal) {
        return false;
      }

      retriedAfterRefusal = true;

      return true;
    }

    if (!isInForeground) {
      if (!retriedInBackground) {
        retriedInBackground = true;
        return true;
      }

      onWaiting();
      await whenInForeground(signal);
      onResumed();
      retries = 0;
      retriedInBackground = false;

      return !signal.aborted;
    }

    if (!received || retries >= RETRY_DELAYS_MS.length) {
      return false;
    }

    await wait(RETRY_DELAYS_MS[retries++], signal);

    return !signal.aborted;
  };
};

const reportedFailures = new Set<number>();

export const isDownloadActive = (modelId: number): boolean =>
  activeDownloads.has(modelId);

export const useActiveDownloadIds = (): ReadonlySet<number> =>
  useSyncExternalStore(subscribeActiveDownloads, () => activeDownloadIds);

export const useHasResumedAtLaunch = (): boolean =>
  useSyncExternalStore(subscribeActiveDownloads, () => hasResumedAtLaunch);

interface DownloadOptions {
  alertOnFailure?: boolean;
  signal?: AbortSignal;
  skipSpaceCheck?: boolean;
}

// A pending download stores each part's URL as the catalogue had it when the
// download started. Before a (re)start, take each part's URL from the catalogue
// as it is now (cached, matched by file name), so a URL fixed upstream since
// then is used. A transfer the OS is still running keeps the URL it started
// with; the new one applies once a part needs a new transfer.
const withLatestCatalogueUrls = (
  modelId: number,
  partsProgress: readonly ModelDownloadPart[],
): ModelDownloadPart[] => {
  const catalogueParts = cachedCatalogueModel(modelId)?.parts ?? [];

  return partsProgress.map(part => {
    const url = catalogueParts.find(
      candidate => candidate.fileName === part.fileName,
    )?.url;

    return url === undefined ? { ...part } : { ...part, url };
  });
};

const overallProgress = (partsProgress: readonly ModelDownloadPart[]) => {
  const total = partsProgress.reduce((sum, part) => sum + part.sizeGB, 0);
  if (total <= 0) {
    return (
      partsProgress.reduce((sum, part) => sum + part.progress, 0) /
      Math.max(partsProgress.length, 1)
    );
  }

  return (
    partsProgress.reduce((sum, part) => sum + part.progress * part.sizeGB, 0) /
    total
  );
};

const useRunDownload = () => {
  const { t } = useTranslation();

  return useCallback(
    async (
      download: ModelDownload,
      { alertOnFailure = true }: DownloadOptions = {},
    ): Promise<void> => {
      const { model } = download;

      if (activeDownloads.get(model.id)?.signal.aborted) {
        await whenStoppedDownloadEnded(model.id);
      }

      if (activeDownloads.has(model.id)) {
        return;
      }

      const controller = new AbortController();
      setActiveDownload(model.id, controller);

      // Stops the parts still transferring: the user stopped the download, or
      // one part failed for good and the download is dropped.
      const partsController = new AbortController();
      const stopParts = () => partsController.abort();
      controller.signal.addEventListener('abort', stopParts);

      let modelDownloaded = false;
      const partsProgress = withLatestCatalogueUrls(
        model.id,
        download.partsProgress,
      );
      const waitingParts = new Set<number>();

      const reportActivity = () =>
        reportDownloadActivity(model.id, {
          name: model.name,
          progress: overallProgress(partsProgress),
          sizeGB: partsProgress.reduce((sum, part) => sum + part.sizeGB, 0),
          status:
            waitingParts.size > 0 &&
            waitingParts.size ===
              partsProgress.filter(part => part.progress < 1 || !part.path)
                .length
              ? 'waiting'
              : 'downloading',
        });

      const saveProgress = () =>
        updateModelDownloadParts(model.id, partsProgress).catch(error =>
          log('runDownload updateModelDownloadParts', error),
        );

      const transferPart = async (i: number): Promise<void> => {
        const signal = partsController.signal;
        const shouldRetry = createPartRetryPolicy(signal, {
          onWaiting: () => {
            waitingParts.add(i);
            reportActivity();
          },
          onResumed: () => waitingParts.delete(i),
        });
        let received = partsProgress[i].progress > 0;

        for (let attempt = 1; attempt <= MAX_PART_ATTEMPTS; attempt++) {
          try {
            const path = await downloadModelPart(
              model.id,
              partsProgress[i].url,
              partsProgress[i].fileName,
              signal,
              (downloaded, total) => {
                if (signal.aborted) {
                  return;
                }

                if (downloaded > 0) {
                  received = true;
                }

                const progress = total > 0 ? downloaded / total : 0;

                if (
                  Math.abs(progress - partsProgress[i].progress) >=
                    DOWNLOAD_THROTTLE ||
                  progress >= 1
                ) {
                  partsProgress[i] = { ...partsProgress[i], progress };
                  saveProgress();
                }

                reportActivity();
              },
              { title: model.name },
            );

            partsProgress[i] = { ...partsProgress[i], progress: 1, path };
            await updateModelDownloadParts(model.id, partsProgress);
            return;
          } catch (error) {
            if (!signal.aborted) {
              log('runDownload part failed', partsProgress[i].fileName, error);
            }

            if (
              attempt === MAX_PART_ATTEMPTS ||
              !(await shouldRetry(error, received))
            ) {
              // Refused for good: the download is dropped, so no use letting the others finish.
              if (isPermanentDownloadFailure(error)) {
                partsController.abort();
              }
              throw error;
            }
          }
        }
      };

      try {
        reportActivity();

        const unfinished = partsProgress
          .map((part, i) => ({ part, i }))
          .filter(({ part }) => !(part.progress >= 1 && part.path))
          .map(({ i }) => i);

        const results = await Promise.allSettled(unfinished.map(transferPart));
        const failures = results.flatMap(result =>
          result.status === 'rejected' ? [result.reason as unknown] : [],
        );

        if (controller.signal.aborted) {
          return;
        }

        if (failures.length > 0) {
          throw failures.find(isPermanentDownloadFailure) ?? failures[0];
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
        finishDownloadActivity(model.id, 'downloaded');

        await deleteModelDownload(model.id);

        const tookFreeSlot = await selectModelIfSlotFree(model);

        // The user had no chat model in use and now has one: show them the chat
        if (
          tookFreeSlot &&
          slotForPipeline(model.pipeline) === ModelSlot.chat
        ) {
          notifyChatModelArrival();
        }
      } catch (error) {
        // The server refused the URL (404...), download is dropped.
        const isPermanent =
          !controller.signal.aborted && isPermanentDownloadFailure(error);
        log('ModelsScreen runDownload', error);

        if (
          alertOnFailure &&
          !modelDownloaded &&
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

        if (isPermanent) {
          reportedFailures.delete(model.id);

          await deleteModelDownload(model.id).catch(deleteError =>
            log('runDownload deleteModelDownload', deleteError),
          );

          deleteModelDirectory(model.id);
        }
      } finally {
        controller.signal.removeEventListener('abort', stopParts);

        if (activeDownloads.get(model.id) === controller) {
          setActiveDownload(model.id, undefined);
        }

        if (!modelDownloaded) {
          finishDownloadActivity(
            model.id,
            controller.signal.aborted ? 'stopped' : 'failed',
          );
        }

        if (controller.signal.aborted && !modelDownloaded) {
          deleteModelDirectory(model.id);
        }
      }
    },
    [t],
  );
};

// Restarts every download left pending in the database
const useResumePendingDownloads = () => {
  const runDownload = useRunDownload();

  return useCallback(
    async ({
      reportAgain = false,
      alertOnFailure = true,
    }: { reportAgain?: boolean; alertOnFailure?: boolean } = {}) => {
      try {
        const pendingDownloads = await getModelDownloads();

        if (pendingDownloads.length === 0 && activeDownloads.size === 0) {
          endOrphanDownloadActivities();
        }

        for (const download of pendingDownloads) {
          if (activeDownloads.has(download.model.id)) {
            continue;
          }

          if (reportAgain) {
            reportedFailures.delete(download.model.id);
          }
          runDownload(download, { alertOnFailure });
        }
      } catch (error) {
        log('resumePendingDownloads', error);
      } finally {
        if (!hasResumedAtLaunch) {
          hasResumedAtLaunch = true;
          activeDownloadsListeners.forEach(listener => listener());
        }
      }
    },
    [runDownload],
  );
};

export const useResumeModelDownloads = ({
  alertOnFailure = true,
}: { alertOnFailure?: boolean } = {}) => {
  const resumePendingDownloads = useResumePendingDownloads();

  // Read by each resume as it runs, so a change doesn't resume again.
  const alertOnFailureRef = useRef(alertOnFailure);
  alertOnFailureRef.current = alertOnFailure;

  useEffect(() => {
    const resume = () =>
      resumePendingDownloads({ alertOnFailure: alertOnFailureRef.current });

    resume();

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') {
        isInForeground = false;
      }

      if (state === 'active') {
        isInForeground = true;
        foregroundWaiters.forEach(release => release());
        resume();
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
      if (!options?.skipSpaceCheck) {
        const inProgress = await getModelDownloads().catch(error => {
          log('startDownload getModelDownloads', error);
          return [];
        });
        const spaceCheck = checkDiskSpaceForModel(model, inProgress);

        if (!spaceCheck.fits) {
          warnNotEnoughSpace([model], spaceCheck);
          return;
        }
      }

      if (options?.signal?.aborted) {
        return;
      }

      if (activeDownloads.get(model.id)?.signal.aborted) {
        await whenStoppedDownloadEnded(model.id);
      }

      const created = await createModelDownload(model);
      if (!created) {
        return;
      }

      if (options?.signal?.aborted) {
        await deleteModelDownload(model.id).catch(error =>
          log('startDownload deleteModelDownload', error),
        );
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

  const stopDownload = useCallback((model: Model): Promise<void> => {
    reportedFailures.delete(model.id);

    const rowDeleted = deleteModelDownload(model.id).catch(error =>
      log('ModelsScreen stopDownload', error),
    );

    const controller = activeDownloads.get(model.id);

    if (controller) {
      controller.abort();
      return rowDeleted;
    }

    // No loop is running (the app was relaunched and hasn't resumed yet, or
    // the download failed and waits for a retry): the OS may still hold its
    // transfers.
    const transfersStopped = stopModelTransfers(model.id)
      .catch(error => log('ModelsScreen stopModelTransfers', error))
      .finally(() => deleteModelDirectory(model.id));
    finishDownloadActivity(model.id, 'stopped');

    return Promise.all([rowDeleted, transfersStopped]).then(() => undefined);
  }, []);

  const promptStopDownloads = useCallback(
    (models: readonly Model[]) => {
      const count = models.length;

      Alert.alert(
        t('screens.models.stopDownloadTitle', { count }),
        t('screens.models.stopDownloadMessage', { count }),
        [
          {
            text: t('screens.models.stopDownload', { count }),
            style: 'destructive',
            onPress: () => models.forEach(stopDownload),
          },
          { text: t('common.cancel'), style: 'cancel' },
        ],
      );
    },
    [t, stopDownload],
  );

  const promptStopDownload = useCallback(
    (model: Model) => promptStopDownloads([model]),
    [promptStopDownloads],
  );

  return {
    startDownload,
    stopDownload,
    promptStopDownload,
    promptStopDownloads,
    warnNotEnoughSpace,
    resumeDownloads,
    resumeDownload: runDownload,
  };
};
