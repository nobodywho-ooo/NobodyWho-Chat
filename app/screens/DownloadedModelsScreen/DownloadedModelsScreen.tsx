import React, { useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppState, useModels, useStyled } from 'hooks';
import { setAppState } from 'database';
import { Button, ModelCard, Text } from 'components';
import { Model } from 'types';

import styles from './DownloadedModelsScreen.styles';

export const DownloadedModelsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { models } = useModels();
  const { modelIdInUse } = useAppState();
  const navigation = useNavigation();

  const handleModelPress = useCallback(
    (model: Model) => {
      setAppState({ modelIdInUse: model.id, conversationIdInUse: undefined });
    },
    [navigation],
  );

  if (models.length === 0) {
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
            isSelected={modelIdInUse === model.id}
            model={model}
            onPress={handleModelPress}
          />
        );
      })}
    </ScrollView>
  );
};
