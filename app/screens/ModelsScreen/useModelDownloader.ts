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
import { getAppState, setAppState } from 'database';
import { Model, ModelDownload, ModelPart } from 'types';
import { deleteModelPartFiles, downloadModelPart, log } from 'helpers';

const DOWNLOAD_THROTTLE = 0.01; // 1% step

// Live downloads keyed by model id, each with the AbortController that cancels
// its loop. Module-level (not state) so it survives remounts and so the
// resume-on-foreground effect and a user-initiated stop share the same map.
const activeDownloads = new Map<number, AbortController>();

export const useModelDownloader = () => {
  const { t } = useTranslation();

  const runDownload = useCallback(async (download: ModelDownload) => {
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
              updateModelDownloadParts(model.id, partsProgress).catch(error => {
                log('runDownload updateModelDownloadParts', error);
              });
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
      await insertModel({ ...model, parts: downloadedParts });
      modelDownloaded = true;

      if (getAppState().modelIdInUse === undefined) {
        await setAppState({
          modelIdInUse: model.id,
          conversationIdInUse: undefined,
        });
      }

      await deleteModelDownload(model.id);
    } catch (error) {
      log('ModelsScreen runDownload', error, {
        capture: !controller.signal.aborted, // TODO: delete capture when model downloading is stable
      });
    } finally {
      if (activeDownloads.get(model.id) === controller) {
        activeDownloads.delete(model.id);
      }

      if (controller.signal.aborted && !modelDownloaded) {
        deleteModelPartFiles(model.parts.map(part => part.fileName));
      }
    }
  }, []);

  const startDownload = useCallback(
    async (model: Model) => {
      const created = await createModelDownload(model);
      if (!created) {
        return;
      }

      await runDownload({
        model,
        partsProgress: model.parts.map(part => ({ ...part, progress: 0 })),
      });
    },
    [runDownload],
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
      deleteModelPartFiles(model.parts.map(part => part.fileName));
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
        log('ModelsScreen resumeDownloads', error, { capture: true });
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

  return { startDownload, promptStopDownload };
};
