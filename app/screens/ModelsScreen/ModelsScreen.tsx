import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { HeaderScrollView } from 'components';
import { useTranslation } from 'react-i18next';
import { useKeepAwakeWhile, useModelDownloader, useStyled } from 'hooks';
import { modelSizeLabel } from 'helpers';
import { Spacings } from 'style';
import { Model } from 'types';

import styles from './ModelsScreen.styles';
import { useAvailableModels } from './useAvailableModels';
import {
  AvailableModels,
  DownloadedModelsSection,
  DownloadingModels,
  InUseModels,
  ModelsTabs,
  type ModelsTab,
} from './components';

export const ModelsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const [tab, setTab] = useState<ModelsTab>('discover');

  const {
    downloads,
    availableModels,
    recommendedModels,
    inUseModels,
    isLoading,
    hasError,
    hasFetched,
    refetch,
  } = useAvailableModels();
  const { startDownload, promptStopDownload } = useModelDownloader();
  useKeepAwakeWhile(downloads.length > 0);

  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const pendingScrollModelIdRef = useRef<number | undefined>(undefined);

  const downloadModel = useCallback(
    (model: Model) => {
      pendingScrollModelIdRef.current = model.id;
      startDownload(model);
    },
    [startDownload],
  );

  const confirmDownload = useCallback(
    (model: Model) =>
      Alert.alert(
        t('screens.models.confirmDownloadTitle', { name: model.name }),
        t('screens.models.confirmDownloadMessage', {
          name: model.name,
          size: modelSizeLabel(model.sizeGB),
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('screens.models.confirmDownload'),
            isPreferred: true,
            onPress: () => downloadModel(model),
          },
        ],
      ),
    [t, downloadModel],
  );

  useEffect(() => {
    const modelId = pendingScrollModelIdRef.current;
    if (
      modelId === undefined ||
      !downloads.some(download => download.model.id === modelId)
    ) {
      return;
    }

    pendingScrollModelIdRef.current = undefined;
    if (tab === 'discover' || tab === 'recommended') {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [downloads, tab]);

  const showModelInfo = useCallback(
    () =>
      Alert.alert(
        t('screens.models.chooseModelTitle'),
        t('screens.models.chooseModelMessage'),
      ),
    [t],
  );

  return (
    <HeaderScrollView
      ref={scrollRef}
      style={[styles.container, { backgroundColor: colors.surface }]}
    >
      <ModelsTabs selected={tab} onSelect={setTab} />

      {(tab === 'discover' || tab === 'recommended') && (
        <>
          {downloads.length > 0 && (
            <DownloadingModels
              downloads={downloads}
              onStopPress={promptStopDownload}
            />
          )}

          <AvailableModels
            models={tab === 'recommended' ? recommendedModels : availableModels}
            isLoading={isLoading}
            hasError={hasError}
            hasFetched={hasFetched}
            onModelPress={confirmDownload}
            onRetry={refetch}
            onInfoPress={showModelInfo}
          />
        </>
      )}

      {tab === 'inUse' && <InUseModels models={inUseModels} />}

      {tab === 'downloaded' && <DownloadedModelsSection />}

      <View style={{ height: Spacings.lg }} />
    </HeaderScrollView>
  );
};
