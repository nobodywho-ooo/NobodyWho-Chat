import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useStyled } from 'hooks';
import { filter, includes } from 'ramda';
import { ErrorView, ListItem, ModelCard, Text } from 'components';
import { Model, ModelPipeline } from 'types';

import styles from './ModelsScreen.styles';

const MODELS_URL =
  'https://raw.githubusercontent.com/pielouNW/mobile-backend/refs/heads/main/backend.json';

export const ModelsScreen: React.FC = () => {
  const { colors } = useStyled();
  const navigation = useNavigation();
  const [currentModel, setCurrentModel] = useState<Model | undefined>();
  const [models, setModels] = useState<Model[]>([]);
  const [modelsDownloading, setModelsDownloading] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [hasFetch, setHasFetch] = useState(false);
  const showModelsToDownload = !isLoading && !hasError && models.length > 0;

  const modelsIdDownloading = [1];
  const modelsIdDownloaded = [2];

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const response = await fetch(MODELS_URL);
      const data: Model[] = await response.json();
      const isAvailableToDownload = (model: Model) =>
        !includes(model.id, [...modelsIdDownloading, ...modelsIdDownloaded]);

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

  useEffect(() => {
    fetchModels();
    // WIP: fake model for now
    let model: Model = {
      id: 1,
      modelName: 'Qwen3 4B Q4 K M',
      modelSizeGB: 2.5,
      parameterCountBillions: 4,
      author: 'Qwen',
      family: 'Qwen3',
      paths: [
        {
          modelPath:
            'https://huggingface.co/NobodyWho/Qwen_Qwen3-0.6B-GGUF/resolve/main/Qwen_Qwen3-0.6B-Q4_K_M.gguf',
          fileName: 'Qwen_Qwen3-0.6B-Q4_K_M.gguf',
        },
      ],
      pipeline: ModelPipeline.textGeneration,
      tags: ['Fast'],
    };
    setCurrentModel(model);
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
            In use
          </Text>
          <ModelCard
            key={currentModel.id}
            isSelected
            model={currentModel}
            onPress={handleModelPress}
          />
        </>
      )}
      {modelsIdDownloaded.length > 0 && (
        <>
          <Text
            variant="h4"
            style={!!currentModel ? styles.header : styles.firstHeader}
          >
            Ready to use
          </Text>
          <ListItem
            title={'Downloaded'}
            subtitle={`${modelsIdDownloaded.length} models`}
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
            Downloading...
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
        Available to Download
      </Text>
      {isLoading && (
        <ActivityIndicator
          style={styles.loader}
          color={colors.onSurfaceVariant}
        />
      )}
      {hasError && (
        <ErrorView
          message="Cannot get the models at the moment"
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
        <Text>You have downloaded all the models.</Text>
      )}
    </ScrollView>
  );
};
