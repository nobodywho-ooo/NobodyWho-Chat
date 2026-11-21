import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, PlatformIcon, ProgressBar, Text } from 'components';
import {
  CURATED_SEARCH_MODELS,
  modelSizeLabel,
  overallDownloadProgress,
} from 'helpers';
import { useCuratedModels, useStyled } from 'hooks';
import { canRerankWithEmbeddings } from 'services';
import { Model } from 'types';
import { Spacings } from 'style';

import { styles } from './EmbeddingDownloadSheet.styles';

const SHEET_ENTER_MS = 260;
const ICON_SIZE = 28;

export type EmbeddingPromptOutcome = 'ready' | 'dismissed' | 'unavailable';

interface EmbeddingDownloadSheetProps {
  chatModel: Model | undefined;
  ramGB: number | undefined;
  required: boolean;
  onClose: (outcome: EmbeddingPromptOutcome) => void;
}

export const EmbeddingDownloadSheet: React.FC<EmbeddingDownloadSheetProps> = ({
  chatModel,
  ramGB,
  required,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);
  const {
    availabilityOf,
    downloadCurated,
    isDownloading,
    progress: batchProgress,
  } = useCuratedModels(undefined, CURATED_SEARCH_MODELS);

  const availability = availabilityOf(CURATED_SEARCH_MODELS);
  const offered =
    availability.kind === 'automatic' &&
    canRerankWithEmbeddings(chatModel, availability.models[0], ramGB);
  const visible =
    offered || availability.kind === 'inProgress' || isDownloading;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closedRef = useRef(false);

  const close = useCallback((outcome: EmbeddingPromptOutcome) => {
    if (closedRef.current) {
      return;
    }

    closedRef.current = true;
    onCloseRef.current(outcome);
  }, []);

  useEffect(() => {
    if (availability.kind === 'ready') {
      close('ready');
    } else if (
      availability.kind === 'manual' ||
      (availability.kind === 'automatic' && !offered && !isDownloading)
    ) {
      close('unavailable');
    }
  }, [availability.kind, offered, isDownloading, close]);

  const download = useCallback(async () => {
    setFailed(false);

    const outcome = await downloadCurated(CURATED_SEARCH_MODELS, {
      alertOnFailure: false,
    });

    if (outcome === 'failed') {
      setFailed(true);
    }
  }, [downloadCurated]);

  const dismiss = useCallback(() => close('dismissed'), [close]);

  const downloading = isDownloading || availability.kind === 'inProgress';
  const progress = isDownloading
    ? batchProgress
    : availability.kind === 'inProgress'
      ? overallDownloadProgress(availability.downloads)
      : 0;
  const size =
    availability.kind === 'automatic'
      ? modelSizeLabel(availability.sizeGB)
      : '';

  const message = failed
    ? t('screens.chat.embeddingDownload.failed')
    : downloading
      ? t('screens.chat.embeddingDownload.downloading')
      : t(
          required
            ? 'screens.chat.embeddingDownload.required'
            : 'screens.chat.embeddingDownload.optional',
          { size },
        );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={styles.rootContainer}>
        <Pressable
          style={styles.backdropContainer}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={t('screens.chat.embeddingDownload.cancel')}
          testID="embedding-download-backdrop"
        />
        <Animated.View
          entering={SlideInDown.duration(SHEET_ENTER_MS)}
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.surface,
              paddingBottom: insets.bottom + Spacings.lg,
            },
          ]}
          testID="embedding-download-sheet"
        >
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: colors.surfaceContainer },
            ]}
          >
            <PlatformIcon
              iosIconName="globe"
              androidIconName="language"
              size={ICON_SIZE}
              color={colors.primary}
            />
          </View>
          <Text variant="h3" bold style={styles.centeredText}>
            {t('screens.chat.embeddingDownload.title')}
          </Text>
          <Text
            variant="body1"
            style={[styles.centeredText, { color: colors.onSurfaceVariant }]}
          >
            {message}
          </Text>
          {downloading && !failed ? (
            <View style={styles.progressContainer}>
              <ProgressBar progress={progress} />
              <Text
                variant="body2"
                style={[
                  styles.centeredText,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                {`${Math.round(progress * 100)}%`}
              </Text>
            </View>
          ) : (
            <View style={styles.actionsContainer}>
              <Button
                title={t(
                  failed
                    ? 'screens.chat.embeddingDownload.retry'
                    : 'screens.chat.embeddingDownload.download',
                )}
                onPress={download}
                testID="embedding-download-confirm"
              />
              <Button
                variant="outline"
                title={t('screens.chat.embeddingDownload.cancel')}
                onPress={dismiss}
                testID="embedding-download-cancel"
              />
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};
