import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { downloadModel } from 'react-native-nobodywho';
import { useAppState, useModels, useStyled } from 'hooks';
import { filter, find, includes, map, pathEq, prop } from 'ramda';
import { ErrorView, ListItem, ModelCard, Text } from 'components';
import { insertModel } from 'repositories';
import { Model, ModelPart } from 'types';
import { log } from 'helpers';

import styles from './ModelsScreen.styles';

const MODELS_URL =
  'https://raw.githubusercontent.com/pielouNW/mobile-backend/refs/heads/main/backend.json';

// Placeholder until the download flow lands.
const MODEL_IDS_DOWNLOADING = [1];

export const ModelsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const navigation = useNavigation();
  const { models: storedModels } = useModels();
  const { modelIdInUse } = useAppState();
  const [models, setModels] = useState<Model[]>([]);
  const [modelsDownloading, setModelsDownloading] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [hasFetch, setHasFetch] = useState(false);
  const showModelsToDownload = !isLoading && !hasError && models.length > 0;

  const downloadedModelIds = useMemo(
    () => map(prop('id'), storedModels),
    [storedModels],
  );

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const response = await fetch(MODELS_URL);
      const data: Model[] = await response.json();
      const isAvailableToDownload = (model: Model) =>
        !includes(model.id, [...MODEL_IDS_DOWNLOADING, ...downloadedModelIds]);

      setModels(filter(isAvailableToDownload, data));

      const isDownloading = (model: Model) =>
        includes(model.id, MODEL_IDS_DOWNLOADING);

      setModelsDownloading(filter(isDownloading, data));
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
      setHasFetch(true);
    }
  }, [downloadedModelIds]);

  const currentModel = useMemo(
    () => find(pathEq(modelIdInUse, ['id']), storedModels),
    [modelIdInUse, storedModels],
  );

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleModelPress = useCallback(async (model: Model) => {
    console.log('Model pressed:', model);

    if (model.parts.length !== 0) {
      try {
        let parts: ModelPart[] = [];

        for (let i = 0; i < model.parts.length; i++) {
          const part = model.parts[i];
          const path = await downloadModel({
            modelPath: part.url,
            onDownloadProgress: (downloaded, total) => {
              console.log(`downloaded ${downloaded}`);
              console.log(`total ${total}`);
            },
          });

          parts.push({
            url: part.url,
            fileName: part.fileName,
            type: part.type,
            path,
          });
        }

        await insertModel({
          id: model.id,
          name: model.name,
          sizeGB: model.sizeGB,
          parameterCountBillions: model.parameterCountBillions,
          author: model.author,
          family: model.family,
          thinking: model.thinking,
          imageIngestion: model.imageIngestion,
          audioIngestion: model.audioIngestion,
          parts: parts,
          pipeline: model.pipeline,
          tags: model.tags,
        });
      } catch (error) {
        log(`ModelsScreen handleModelPress`, error);
      }
    }
  }, []);

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
            iosIconName={'cpu'}
            androidIconName={'memory'}
            iconBackgroundColor={colors.primary}
            // @ts-ignore
            onPress={() => navigation.navigate('DownloadedModelsScreen')}
          />
        </>
      )}
      {modelsDownloading.length > 0 && (
        <>
          <Text variant="h4" style={styles.header}>
            {t('screens.models.downloading')}
          </Text>
          {modelsDownloading.map(model => (
            <ModelCard
              key={model.id}
              model={model}
              downloadProgress={0.4}
              onPress={handleModelPress}
            />
          ))}
        </>
      )}

      <Text variant="h4" style={styles.header}>
        {t('screens.models.availableToDownload')}
      </Text>
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
        />
      )}
      {showModelsToDownload &&
        models.map(model => (
          <ModelCard
            key={model.id}
            model={model}
            downloadProgress={model.id === 1 ? 0.4 : undefined}
            onPress={handleModelPress}
          />
        ))}
      {hasFetch && models.length === 0 && (
        <Text>{t('screens.models.youHaveDownloadedAllTheModels')}</Text>
      )}
    </ScrollView>
  );
};
