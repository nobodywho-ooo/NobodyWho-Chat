import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, PlatformIcon, ProgressBar, Text } from 'components';
import { progressPercent } from 'helpers';
import { useStyled } from 'hooks';
import { Spacings } from 'style';

import { useVoiceModelDownloads } from '../hooks';
import type { VoiceAssistantStatus, VoiceSetupState } from '../hooks';

interface VoiceSetupProps {
  status: VoiceAssistantStatus;
  onOpenModels: () => void;
}

const descriptionKey = (state: VoiceSetupState) => {
  if (state === 'downloading') {
    return 'screens.voiceAssistant.setup.downloadInProgress';
  }

  if (state === 'interrupted') {
    return 'screens.voiceAssistant.setup.downloadInterrupted';
  }

  return 'screens.voiceAssistant.setup.description';
};

export const VoiceSetup: React.FC<VoiceSetupProps> = ({
  status,
  onOpenModels,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { state, progress, download, resume, cancel } =
    useVoiceModelDownloads();

  const renderChecklistRow = (loaded: boolean, label: string) => (
    <View style={styles.rowContainer}>
      <PlatformIcon
        iosIconName={loaded ? 'checkmark.circle.fill' : 'circle'}
        androidIconName={loaded ? 'check_circle' : 'radio_button_unchecked'}
        size={20}
        color={loaded ? colors.successSurface : colors.onSurfaceVariant}
      />
      <Text
        variant="body2"
        style={{
          color: loaded ? colors.onSurface : colors.onSurfaceVariant,
        }}
      >
        {label}
      </Text>
    </View>
  );

  const renderAction = () => {
    if (status.isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text variant="body2" style={{ color: colors.onSurfaceVariant }}>
            {t('screens.voiceAssistant.setup.loadingModels')}
          </Text>
        </View>
      );
    }

    if (state === 'automatic' || state === 'loading') {
      return (
        <Button
          title={t('screens.voiceAssistant.setup.downloadMissing')}
          testID="voice-download-button"
          disabled={state === 'loading'}
          onPress={download}
          style={styles.downloadButton}
          small
        />
      );
    }

    if (state === 'manual') {
      return (
        <Button
          title={t('screens.voiceAssistant.setup.browseModels')}
          testID="voice-browse-models-button"
          onPress={onOpenModels}
          style={styles.downloadButton}
          small
        />
      );
    }

    if (state === 'interrupted') {
      return (
        <Button
          title={t('screens.voiceAssistant.setup.resumeDownload')}
          testID="voice-resume-download-button"
          icon={{ iosIconName: 'play.fill', androidIconName: 'play_arrow' }}
          onPress={resume}
          style={styles.downloadButton}
          small
        />
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      <Text variant="body1" bold style={styles.title}>
        {t('screens.voiceAssistant.setup.title')}
      </Text>
      <Text
        variant="body2"
        style={[styles.description, { color: colors.onSurfaceVariant }]}
      >
        {t(descriptionKey(state))}
      </Text>
      {state === 'downloading' ? (
        <View style={styles.downloadContainer}>
          <Text variant="body2" bold style={styles.progressLabel}>
            {t('screens.voiceAssistant.setup.downloadProgress', {
              percent: progressPercent(progress),
            })}
          </Text>
          <ProgressBar progress={progress} />
          <Button
            title={t('screens.voiceAssistant.setup.cancelDownload')}
            variant="secondary"
            onPress={cancel}
            style={styles.cancelButton}
          />
        </View>
      ) : (
        <>
          <View style={styles.checklistContainer}>
            {renderChecklistRow(
              status.isChatReady,
              t('screens.voiceAssistant.setup.chat'),
            )}
            {renderChecklistRow(
              status.isSttReady,
              t('screens.voiceAssistant.setup.stt'),
            )}
            {renderChecklistRow(
              status.isTtsReady,
              t('screens.voiceAssistant.setup.tts'),
            )}
            {renderChecklistRow(
              status.isVadReady,
              t('screens.voiceAssistant.setup.vad'),
            )}
          </View>
          {renderAction()}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacings.md,
    paddingHorizontal: Spacings.md,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
  },
  checklistContainer: {
    gap: Spacings.sm,
    marginTop: Spacings.sm,
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.sm,
  },
  downloadContainer: {
    alignSelf: 'stretch',
    gap: Spacings.sm,
    marginTop: Spacings.sm,
  },
  downloadButton: {
    alignSelf: 'stretch',
    marginTop: Spacings.sm,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.sm,
    marginTop: Spacings.sm,
  },
  cancelButton: {
    marginTop: Spacings.xl,
  },
  progressLabel: {
    textAlign: 'center',
  },
});
