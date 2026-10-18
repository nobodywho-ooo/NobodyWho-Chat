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
import { Model, ModelDownload, ModelPart } from 'types';
import type { DiskSpaceCheck } from 'helpers';
import {
  checkDiskSpaceForModel,
  deleteModelDirectory,
  downloadModelPart,
  log,
  modelSizeLabel,
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

// False until the launch resume has restarted the pending downloads: until then
// a pending download only looks interrupted.
let hasResumedAtLaunch = false;

// Resolves once the model has no stopped loop still winding down. A stopped
// loop deletes the model directory as it ends, so a restart must not begin
// writing there until it has.
const stoppedDownloadSettled = (modelId: number) =>
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

// Trips to the background so far, and whether the app is back from the last
// one. The OS can cut a transfer while the app is away, and that failure lands
// whenever it likes: in the background, on the way back, or just after the
// return. A loop that was running across a trip treats its failure as that cut.
let backgroundTrips = 0;
let isInForeground = true;

// Loops waiting for the app to come back, released by the 'active' event.
const foregroundWaiters = new Set<() => void>();

// Resolves once the app is in the foreground, or the download is stopped.
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

// Models whose failure the user was already told about. Resume retries pending
// downloads on every return to the app, so one that keeps failing (offline)
// would otherwise alert again each time.
const reportedFailures = new Set<number>();

// Whether a download loop is running for the model right now.
export const isDownloadActive = (modelId: number): boolean =>
  activeDownloads.has(modelId);

// The models whose download loop is running, re-rendering when one starts or
// stops: a pending download that isn't in it is interrupted (it failed, or the app
// was closed mid-download).
export const useActiveDownloadIds = (): ReadonlySet<number> =>
  useSyncExternalStore(subscribeActiveDownloads, () => activeDownloadIds);

// Whether the launch resume has had its chance to restart pending downloads.
export const useHasResumedAtLaunch = (): boolean =>
  useSyncExternalStore(subscribeActiveDownloads, () => hasResumedAtLaunch);

interface DownloadOptions {
  alertOnFailure?: boolean;
  signal?: AbortSignal;
  skipSpaceCheck?: boolean;
}

// The download loop shared by a fresh start and a resume.
const useRunDownload = () => {
  const { t } = useTranslation();

  return useCallback(
    async function run(
      download: ModelDownload,
      { alertOnFailure = true }: DownloadOptions = {},
    ): Promise<void> {
      const { model } = download;

      // Started again right after a stop: wait for the stopped loop to end
      // rather than mistake it for this download already running.
      if (activeDownloads.get(model.id)?.signal.aborted) {
        await stoppedDownloadSettled(model.id);
      }

      if (activeDownloads.has(model.id)) {
        return;
      }

      const controller = new AbortController();
      setActiveDownload(model.id, controller);

      let modelDownloaded = false;
      let isTransferring = true;
      let restartAfterBackgroundCut = false;
      const tripsAtStart = backgroundTrips;
      const partsProgress = download.partsProgress.map(part => ({ ...part }));

      try {
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
        isTransferring = false;

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

        // Dropped before the slot selection so a failure there can't leave an
        // installed model looking like a pending download to resume.
        await deleteModelDownload(model.id);

        await selectModelIfSlotFree(model);
      } catch (error) {
        // Cut by a trip to the background: not reported, but restarted by this
        // loop once the app is back. Only once: the restart reports a failure
        // of its own.
        const wasCutInBackground =
          isTransferring &&
          !controller.signal.aborted &&
          backgroundTrips !== tripsAtStart;
        restartAfterBackgroundCut = wasCutInBackground;
        log('ModelsScreen runDownload', error);

        if (
          alertOnFailure &&
          !modelDownloaded &&
          !controller.signal.aborted &&
          !wasCutInBackground &&
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

        // Still registered as running while it waits, so the resume on return
        // leaves it alone and a caller awaiting it gets the real outcome.
        if (wasCutInBackground) {
          await whenInForeground(controller.signal);
        }
      } finally {
        if (activeDownloads.get(model.id) === controller) {
          setActiveDownload(model.id, undefined);
        }

        if (controller.signal.aborted && !modelDownloaded) {
          deleteModelDirectory(model.id);
        }
      }

      if (restartAfterBackgroundCut && !controller.signal.aborted) {
        await run({ model, partsProgress }, { alertOnFailure });
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

// Resumes pending downloads at launch and on every return to the app.
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
        backgroundTrips++;
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

  // One confirmation for every download in `models`.
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
  };
};
