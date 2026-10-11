import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, PlatformIcon, ProgressBar, Text } from 'components';
import { useActiveDownloadIds, useModelDownloader, useStyled } from 'hooks';
import { modelDownloadProgress } from 'repositories';
import { ModelDownload } from 'types';

import styles from './DownloadingChatModels.styles';

interface DownloadingChatModelsProps {
  downloads: readonly ModelDownload[];
}

// Stands in for "No model available" while chat models are on their way, e.g.
// after the app was closed during onboarding's download.
export const DownloadingChatModels: React.FC<DownloadingChatModelsProps> = ({
  downloads,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { resumeDownloads } = useModelDownloader();
  const activeIds = useActiveDownloadIds();

  const count = downloads.length;
  const isAnyActive = downloads.some(({ model }) => activeIds.has(model.id));
  const isAnyPaused = downloads.some(({ model }) => !activeIds.has(model.id));

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <PlatformIcon
        iosIconName={isAnyActive ? 'arrow.down.circle' : 'pause.circle'}
        androidIconName={isAnyActive ? 'downloading' : 'pause_circle'}
        size={50}
        color={colors.onSurfaceDisabled}
      />
      <Text variant="h3" style={styles.title}>
        {t(
          isAnyActive
            ? 'screens.noModelDownloaded.downloadingTitle'
            : 'screens.noModelDownloaded.pausedTitle',
          { count },
        )}
      </Text>
      <View style={styles.modelsContainer}>
        {downloads.map(download => {
          const { model } = download;
          const progress = modelDownloadProgress(download);

          return (
            <View key={model.id} style={styles.modelContainer}>
              <Text variant="h4" bold>
                {model.name}
              </Text>
              <Text variant="body2" style={{ color: colors.onSurfaceVariant }}>
                {t(
                  activeIds.has(model.id)
                    ? 'screens.noModelDownloaded.downloadProgress'
                    : 'screens.noModelDownloaded.pausedProgress',
                  { percent: Math.round(Math.min(progress, 1) * 100) },
                )}
              </Text>
              <ProgressBar progress={progress} />
            </View>
          );
        })}
      </View>
      <Text
        variant="body2"
        style={[styles.hint, { color: colors.onSurfaceVariant }]}
      >
        {t(
          isAnyActive
            ? 'screens.noModelDownloaded.downloadingHint'
            : 'screens.noModelDownloaded.pausedHint',
          { count },
        )}
      </Text>
      {isAnyPaused && (
        <Button
          title={t('screens.noModelDownloaded.resume')}
          testID="resume-download-button"
          icon={{ iosIconName: 'play.fill', androidIconName: 'play_arrow' }}
          onPress={resumeDownloads}
        />
      )}
    </View>
  );
};
