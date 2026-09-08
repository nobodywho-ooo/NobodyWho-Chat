import React, { useCallback } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useModelDownloads, useStyled } from 'hooks';
import { Spacings } from 'style';
import { ModelSlot } from 'types';

import styles from './ModelsScreen.styles';
import { useAvailableModels } from './useAvailableModels';
import { useModelDownloader } from './useModelDownloader';
import {
  AvailableModels,
  DownloadedModelsLink,
  DownloadingModels,
  InUseModel,
} from './components';

const SLOT_TITLE_KEYS: Record<ModelSlot, string> = {
  [ModelSlot.chat]: 'screens.models.textModelInUse',
  [ModelSlot.tts]: 'screens.models.voiceModelInUse',
  [ModelSlot.stt]: 'screens.models.transcriptionModelInUse',
  [ModelSlot.vad]: 'screens.models.voiceDetectionModelInUse',
};

export const ModelsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const { downloads } = useModelDownloads();
  const {
    availableModels,
    inUseModels,
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
      {inUseModels.map(({ slot, model }, index) => (
        <InUseModel
          key={slot}
          model={model}
          title={t(SLOT_TITLE_KEYS[slot])}
          first={index === 0}
        />
      ))}

      {downloadedCount > 0 && (
        <DownloadedModelsLink
          count={downloadedCount}
          first={inUseModels.length === 0}
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
