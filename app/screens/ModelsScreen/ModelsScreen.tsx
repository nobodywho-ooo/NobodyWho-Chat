import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { HeaderScrollView } from 'components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useKeepAwakeWhile, useModelDownloader, useStyled } from 'hooks';
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
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<ModelsTab>('discover');

  const {
    downloads,
    availableModels,
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

  useEffect(() => {
    const modelId = pendingScrollModelIdRef.current;
    if (
      modelId === undefined ||
      !downloads.some(download => download.model.id === modelId)
    ) {
      return;
    }

    pendingScrollModelIdRef.current = undefined;
    if (tab === 'discover') {
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

      {tab === 'discover' && (
        <>
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
            onModelPress={downloadModel}
            onRetry={refetch}
            onInfoPress={showModelInfo}
          />
        </>
      )}

      {tab === 'inUse' && <InUseModels models={inUseModels} />}

      {tab === 'downloaded' && <DownloadedModelsSection />}

      <View style={{ height: insets.bottom + Spacings.lg }} />
    </HeaderScrollView>
  );
};
