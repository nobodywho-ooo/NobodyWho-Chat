import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, PlatformIcon, ProgressBar, Text } from 'components';
import { modelDownloadProgress, modelDownloadSizeGB } from 'helpers';
import { useActiveDownloadIds, useModelDownloader, useStyled } from 'hooks';
import { ModelDownload } from 'types';

import styles from './DownloadingChatModels.styles';

interface DownloadingChatModelsProps {
  downloads: readonly ModelDownload[];
}

const overallProgress = (downloads: readonly ModelDownload[]): number => {
  const totalGB = downloads.reduce(
    (sum, { model }) => sum + modelDownloadSizeGB(model),
    0,
  );

  if (totalGB <= 0) {
    return 0;
  }

  const downloadedGB = downloads.reduce(
    (sum, download) =>
      sum +
      modelDownloadProgress(download) * modelDownloadSizeGB(download.model),
    0,
  );

  return downloadedGB / totalGB;
};

// Stands in for "No model available" while chat models are on their way, e.g.
// after the app was closed during onboarding's download.
export const DownloadingChatModels: React.FC<DownloadingChatModelsProps> = ({
  downloads,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { resumeDownloads, promptStopDownloads } = useModelDownloader();
  const activeIds = useActiveDownloadIds();

  const count = downloads.length;

  const isAnyActive = downloads.some(({ model }) => activeIds.has(model.id));
  const progress = overallProgress(downloads);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <PlatformIcon
        iosIconName={isAnyActive ? 'arrow.down.circle' : 'pause.circle'}
        androidIconName={isAnyActive ? 'downloading' : 'pause_circle'}
        size={50}
        color={colors.ctaContentPrimary}
      />
      <Text variant="h3" style={styles.title}>
        {t(
          isAnyActive
            ? 'screens.noModelDownloaded.downloadingTitle'
            : 'screens.noModelDownloaded.pausedTitle',
          { count },
        )}
      </Text>
      <Text
        variant="body1"
        style={[styles.hint, { color: colors.onSurfaceVariant }]}
      >
        {t(
          isAnyActive
            ? 'screens.noModelDownloaded.downloadingHint'
            : 'screens.noModelDownloaded.pausedHint',
          { count },
        )}
      </Text>
      <View style={styles.progressContainer}>
        <Text variant="body2" bold>
          {t('screens.noModelDownloaded.downloadProgress', {
            percent: Math.round(Math.min(progress, 1) * 100),
          })}
        </Text>
        <ProgressBar progress={progress} />
      </View>
      <View style={styles.buttonsContainer}>
        {isAnyActive ? (
          <Button
            title={t('screens.models.stopDownload', { count })}
            testID="stop-download-button"
            variant="secondary"
            onPress={() =>
              promptStopDownloads(downloads.map(({ model }) => model))
            }
          />
        ) : (
          <Button
            title={t('screens.noModelDownloaded.resume')}
            testID="resume-download-button"
            icon={{ iosIconName: 'play.fill', androidIconName: 'play_arrow' }}
            onPress={resumeDownloads}
          />
        )}
      </View>
    </View>
  );
};
