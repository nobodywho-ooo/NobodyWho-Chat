import React, { useCallback } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useModelDownloads, useStyled } from 'hooks';
import { Spacings } from 'style';

import styles from './ModelsScreen.styles';
import { useAvailableModels } from './useAvailableModels';
import { useModelDownloader } from './useModelDownloader';
import {
  AvailableModels,
  DownloadedModelsLink,
  DownloadingModels,
  InUseModel,
} from './components';

export const ModelsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const { downloads } = useModelDownloads();
  const {
    availableModels,
    currentModel,
    currentTtsModel,
    currentSttModel,
    downloadedCount,
    isLoading,
    hasError,
    hasFetched,
    refetch,
  } = useAvailableModels();
  const { startDownload, promptStopDownload } = useModelDownloader();

  const showModelInfo = useCallback(
    () =>
      Alert.alert(
        t('screens.models.chooseModelTitle'),
        t('screens.models.chooseModelMessage'),
      ),
    [t],
  );

  const goToDownloadedModels = useCallback(
    () =>
      // @ts-ignore
      navigation.navigate('DownloadedModelsScreen', { canDelete: true }),
    [navigation],
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { backgroundColor: colors.surface }]}
    >
      {!!currentModel && (
        <InUseModel
          model={currentModel}
          title={t('screens.models.textModelInUse')}
        />
      )}

      {!!currentTtsModel && (
        <InUseModel
          model={currentTtsModel}
          title={t('screens.models.voiceModelInUse')}
          first={!currentModel}
        />
      )}

      {!!currentSttModel && (
        <InUseModel
          model={currentSttModel}
          title={t('screens.models.transcriptionModelInUse')}
          first={!currentModel && !currentTtsModel}
        />
      )}

      {downloadedCount > 0 && (
        <DownloadedModelsLink
          count={downloadedCount}
          first={!currentModel && !currentTtsModel && !currentSttModel}
          onPress={goToDownloadedModels}
        />
      )}

      {downloads.length > 0 && (
        <DownloadingModels
          downloads={downloads}
          onStopPress={promptStopDownload}
        />
      )}

      <AvailableModels
        models={availableModels}
        isLoading={isLoading}
        hasError={hasError}
        hasFetched={hasFetched}
        onModelPress={startDownload}
        onRetry={refetch}
        onInfoPress={showModelInfo}
      />

      <View style={{ height: insets.bottom + Spacings.lg }} />
    </ScrollView>
  );
};
