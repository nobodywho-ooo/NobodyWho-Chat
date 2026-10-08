import { useCallback, useEffect } from 'react';
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

interface DownloadOptions {
  // Off for callers that download a batch and report its failure once.
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
      activeDownloads.set(model.id, controller);

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

        await selectModelIfSlotFree(model);

        await deleteModelDownload(model.id);
      } catch (error) {
        const capture =
          !controller.signal.aborted && !(error instanceof NetworkError);
        log('ModelsScreen runDownload', error, {
          // TODO: delete capture when model downloading is stable
          capture,
        });

        if (alertOnFailure && !controller.signal.aborted) {
          Alert.alert(
            t('screens.models.downloadFailedTitle'),
            t('screens.models.downloadFailedModelMessage', {
              name: model.name,
            }),
          );
        }
      } finally {
        if (activeDownloads.get(model.id) === controller) {
          activeDownloads.delete(model.id);
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
export const useResumeModelDownloads = () => {
  const runDownload = useRunDownload();

  useEffect(() => {
    const resumeDownloads = async () => {
      try {
        const pendingDownloads = await getModelDownloads();
        for (const download of pendingDownloads) {
          if (!activeDownloads.has(download.model.id)) {
            runDownload(download);
          }
        }
      } catch (error) {
        log('useResumeModelDownloads resumeDownloads', error);
      }
    };

    resumeDownloads();

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        resumeDownloads();
      }
    });

    return () => subscription.remove();
  }, [runDownload]);
};

export const useModelDownloader = () => {
  const { t } = useTranslation();
  const runDownload = useRunDownload();

  const warnNotEnoughSpace = useCallback(
    (model: Model, check: DiskSpaceCheck) =>
      Alert.alert(
        t('screens.models.notEnoughSpaceTitle'),
        t('screens.models.notEnoughSpaceMessage', {
          name: model.name,
          required: modelSizeLabel(check.requiredGB),
          available: modelSizeLabel(check.availableGB ?? 0),
        }),
      ),
    [t],
  );

  const startDownload = useCallback(
    async (model: Model, options?: DownloadOptions) => {
      const spaceCheck = checkDiskSpaceForModel(model);

      if (!spaceCheck.fits) {
        warnNotEnoughSpace(model, spaceCheck);
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
    deleteModelDownload(model.id).catch(error =>
      log('ModelsScreen stopDownload', error),
    );

    const controller = activeDownloads.get(model.id);
    if (controller) {
      controller.abort();
    } else {
      // No live loop (e.g. it already failed) — clean the files up directly.
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

  return { startDownload, stopDownload, promptStopDownload };
};
