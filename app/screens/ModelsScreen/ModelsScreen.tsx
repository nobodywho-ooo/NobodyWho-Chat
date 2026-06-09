import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useModels, useStyled } from 'hooks';
import { getModelIdInUse } from 'database';
import { filter, find, includes, map, pathEq, prop } from 'ramda';
import { ErrorView, ListItem, ModelCard, Text } from 'components';
import { Model, ModelPipeline } from 'types';

import styles from './ModelsScreen.styles';

const MODELS_URL =
  'https://raw.githubusercontent.com/pielouNW/mobile-backend/refs/heads/main/backend.json';

export const ModelsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const navigation = useNavigation();
  const { models: storedModels } = useModels();
  const [currentModel, setCurrentModel] = useState<Model | undefined>();
  const [models, setModels] = useState<Model[]>([]);
  const [modelsDownloading, setModelsDownloading] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [hasFetch, setHasFetch] = useState(false);
  const showModelsToDownload = !isLoading && !hasError && models.length > 0;

  const modelsIdDownloading = [1];
  const downloadedModelIds = map(prop('id'), storedModels);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const response = await fetch(MODELS_URL);
      const data: Model[] = await response.json();
      const isAvailableToDownload = (model: Model) =>
        !includes(model.id, [...modelsIdDownloading, ...downloadedModelIds]);

      setModels(filter(isAvailableToDownload, data));

      const isDownloading = (model: Model) =>
        includes(model.id, modelsIdDownloading);

      setModelsDownloading(filter(isDownloading, data));
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
      setHasFetch(true);
    }
  }, []);

  const loadModelInUse = useCallback(async () => {
    const modelIdInUse = await getModelIdInUse();
    const currentModel = find(pathEq(modelIdInUse, ['id']), storedModels);
    setCurrentModel(currentModel);
  }, [storedModels]);

  useEffect(() => {
    loadModelInUse();
  }, [loadModelInUse]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleModelPress = useCallback((model: Model) => {
    console.log('Model pressed:', model);
    // Start download
    // Update progress
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
            style={!!currentModel ? styles.header : styles.firstHeader}
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
      {hasFetch && models.length == 0 && (
        <Text>{t('screens.models.youHaveDownloadedAllTheModels')}</Text>
      )}
    </ScrollView>
  );
};
