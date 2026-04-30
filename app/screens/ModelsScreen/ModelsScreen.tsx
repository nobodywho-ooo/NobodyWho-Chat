import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { useStyled } from 'hooks';
import { ErrorView, ListItem, ModelCard, Text } from 'components';
import { Model } from 'types';

import styles from './ModelsScreen.styles';

const MODELS_URL =
  'https://raw.githubusercontent.com/pielouNW/visionos-backend/refs/heads/main/backend.json';

export const ModelsScreen: React.FC = () => {
  const { colors } = useStyled();
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const showModels = !isLoading && !hasError && models.length > 0;
  const modelsIdNotAvailableToDownload = ['1'];

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const response = await fetch(MODELS_URL);
      const data: Model[] = await response.json();
      setModels(data);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleModelPress = useCallback((model: Model) => {
    console.log('Model pressed:', model);
  }, []);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { backgroundColor: colors.surface }]}
    >
      <Text variant="h4" style={styles.firstHeader}>
        Ready to use
      </Text>
      <ListItem
        title={'Downloaded'}
        subtitle={'6 models'}
        iosIconName={'document.fill'}
        androidIconName={'article'}
        iconBackgroundColor="#2ec728"
      />
      <Text variant="h4" style={styles.secondaryHeader}>
        Downloading...
      </Text>
      <Text variant="h4" style={styles.secondaryHeader}>
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
      {showModels &&
        models.map(model => (
          <ModelCard
            key={model.id}
            model={model}
            isDownloading={model.id == 1}
            onPress={handleModelPress}
          />
        ))}
    </ScrollView>
  );
};
