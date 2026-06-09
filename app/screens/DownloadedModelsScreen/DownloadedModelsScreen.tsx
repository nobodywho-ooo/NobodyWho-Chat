import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useModels, useStyled } from 'hooks';
import { getModelIdInUse } from 'database';
import { Button, ModelCard, Text } from 'components';
import { Model } from 'types';

import styles from './DownloadedModelsScreen.styles';

export const DownloadedModelsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { models } = useModels();
  const [modelIdInUse, setModelIdInUse] = useState<number | undefined>();
  const navigation = useNavigation();

  useEffect(() => {
    getModelIdInUse().then(setModelIdInUse);
  }, [models]);

  const handleModelPress = useCallback((model: Model) => {
    console.log('Model pressed:', model);
    // Unload current model
    // load new model
  }, []);

  if (models.length == 0) {
    return (
      <View style={styles.noModelContainer}>
        <Text variant="h4" style={styles.noModelContainerText}>
          {t('screens.downloadedModels.noModelDownloaded')}
        </Text>
        <Button
          title={t('screens.downloadedModels.downloadAModel')}
          onPress={() => navigation.goBack()}
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { backgroundColor: colors.surface }]}
    >
      {models.map(model => {
        return (
          <ModelCard
            key={model.id}
            isDownloaded
            isSelected={modelIdInUse == model.id}
            model={model}
            onPress={handleModelPress}
          />
        );
      })}
    </ScrollView>
  );
};
