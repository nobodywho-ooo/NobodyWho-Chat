import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppState, useModelDownloads, useModels, useStyled } from 'hooks';
import { find, map, pathEq, prop } from 'ramda';
import { ErrorView, ListItem, ModelCard, PlatformIcon, Text } from 'components';
import {
  createModelDownload,
  deleteModelDownload,
  getModelDownloads,
  insertModel,
  modelDownloadProgress,
  updateModelDownloadParts,
} from 'repositories';
import { getAppState, setAppState } from 'database';
import { Model, ModelDownload, ModelPart } from 'types';
import {
  deleteModelPartFiles,
  downloadModelPart,
  filterModelsByDeviceMemory,
  log,
} from 'helpers';
import { Spacings } from 'style';

import styles from './ModelsScreen.styles';

const DOWNLOAD_THROTTLE = 0.01; // 1% step
const MODELS_URL =
  'https://raw.githubusercontent.com/pielouNW/mobile-backend/refs/heads/main/backend.json';

const activeDownloads = new Map<number, AbortController>();

export const ModelsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { models: storedModels } = useModels();
  const { downloads } = useModelDownloads();
  const { modelIdInUse } = useAppState();
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [hasFetch, setHasFetch] = useState(false);

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

  const showModelsToDownload =
    !isLoading && !hasError && availableModels.length > 0;

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
      setHasFetch(true);
    }
  }, []);

  const currentModel = useMemo(
    () => find(pathEq(modelIdInUse, ['id']), storedModels),
    [modelIdInUse, storedModels],
  );

  const showModelInfo = useCallback(
    () =>
      Alert.alert(
        t('screens.models.chooseModelTitle'),
        t('screens.models.chooseModelMessage'),
      ),
    [t],
  );

  const stopDownload = useCallback((model: Model) => {
    deleteModelDownload(model.id).catch(error =>
      log('ModelsScreen stopDownload', error),
    );

    const controller = activeDownloads.get(model.id);
    if (controller) {
      controller.abort();
    } else {
      // No live loop e.g. it already failed
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
        capture: !controller.signal.aborted,
      });

      if (!controller.signal.aborted) {
        deleteModelDownload(model.id).catch(deleteError => {
          log('ModelsScreen runDownload deleteModelDownload', deleteError);
        });
      }
    } finally {
      if (activeDownloads.get(model.id) === controller) {
        activeDownloads.delete(model.id);
      }

      if (controller.signal.aborted && !modelDownloaded) {
        deleteModelPartFiles(model.parts.map(part => part.fileName));
      }
    }
  }, []);

  const handleModelPress = useCallback(
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

    fetchModels();
    resumeDownloads();

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        resumeDownloads();
      }
    });
    return () => subscription.remove();
  }, [fetchModels, runDownload]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { backgroundColor: colors.surface }]}
    >
      {!!currentModel && (
        <>
          <Text variant="h4" style={styles.firstHeader}>
            {t('screens.models.inUse')}
          </Text>
          <ModelCard key={currentModel.id} isSelected model={currentModel} />
        </>
      )}
      {downloadedModelIds.length > 0 && (
        <>
          <Text
            variant="h4"
            style={currentModel ? styles.header : styles.firstHeader}
          >
            {t('screens.models.readyToUse')}
          </Text>
          <ListItem
            title={t('screens.models.downloaded')}
            subtitle={t('screens.models.modelCount', {
              count: downloadedModelIds.length,
            })}
            iosIconName={'arrow.down.circle.fill'}
            androidIconName={'deployed_code_update'}
            iconBackgroundColor={colors.primary}
            onPress={() =>
              // @ts-ignore
              navigation.navigate('DownloadedModelsScreen', { canDelete: true })
            }
          />
        </>
      )}
      {downloads.length > 0 && (
        <>
          <Text variant="h4" style={styles.header}>
            {t('screens.models.downloading')}
          </Text>
          {downloads.map(download => (
            <ModelCard
              key={download.model.id}
              model={download.model}
              downloadProgress={modelDownloadProgress(download)}
              onPress={promptStopDownload}
            />
          ))}
        </>
      )}

      <View style={styles.headerContainer}>
        <Text variant="h4">{t('screens.models.availableToDownload')}</Text>
        <Pressable
          onPress={showModelInfo}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('screens.models.chooseModelTitle')}
        >
          <PlatformIcon
            iosIconName="info.circle"
            androidIconName="info"
            size={20}
            color={colors.primary}
          />
        </Pressable>
      </View>
      {isLoading && (
        <ActivityIndicator
          style={styles.loader}
          color={colors.onSurfaceVariant}
        />
      )}
      {hasError && (
        <ErrorView
          message={t('screens.models.errorCannotGetModelsAtTheMoment')}
          onRetry={fetchModels}
          paddingVertical={Spacings.md}
          alignLeft
        />
      )}
      {showModelsToDownload &&
        availableModels.map(model => (
          <ModelCard key={model.id} model={model} onPress={handleModelPress} />
        ))}
      <View style={{ height: insets.bottom + Spacings.lg }} />
      {hasFetch && !hasError && availableModels.length === 0 && (
        <Text>{t('screens.models.youHaveDownloadedAllTheModels')}</Text>
      )}
    </ScrollView>
  );
};
