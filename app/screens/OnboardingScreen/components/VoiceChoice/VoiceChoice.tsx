import React, { useCallback, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, PlatformIcon, ProgressBar, Text } from 'components';
import {
  curatedChatModel,
  CuratedModel,
  CURATED_VOICE_ONLY_MODELS,
} from 'helpers';
import { useCuratedModels, useStyled } from 'hooks';
import { Spacings } from 'style';

import { OnboardingScreenProps } from '../../Onboarding.types';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useOnboardingHeader } from '../../hooks/useOnboardingHeader';
import { OnboardingCard } from '../OnboardingCard/OnboardingCard';
import { OnboardingStep } from '../OnboardingStep/OnboardingStep';

import styles from './VoiceChoice.styles';

const CHOICE_ICON_SIZE = 24;

export const VoiceChoice: React.FC<OnboardingScreenProps<'VoiceChoice'>> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { catalogue, onFinish } = useOnboarding();
  const { modelId } = route.params;
  const insets = useSafeAreaInsets();

  const [isDone, setIsDone] = useState(false);

  const {
    findModelsToDownload,
    isDownloading,
    progress,
    downloadCurated,
    cancel,
  } = useCuratedModels(catalogue);

  useOnboardingHeader(navigation, isDownloading || isDone);

  const curatedTextModels = useMemo(
    () => [curatedChatModel(modelId)],
    [modelId],
  );
  const curatedVoiceModels = useMemo(
    () => [...curatedTextModels, ...CURATED_VOICE_ONLY_MODELS],
    [curatedTextModels],
  );

  const downloadSizeGB = useCallback(
    (curated: readonly CuratedModel[]) =>
      findModelsToDownload(curated).reduce(
        (sum, model) => sum + model.sizeGB,
        0,
      ),
    [findModelsToDownload],
  );

  const download = useCallback(
    async (curated: readonly CuratedModel[]) => {
      const outcome = await downloadCurated(curated, {
        alertOnFailure: false,
      });

      // The download itself selected the chat model into its free slot.
      if (outcome === 'done') {
        setIsDone(true);
      }

      // Still downloading in the background: the app shows its progress.
      if (outcome === 'inProgress') {
        onFinish();
      }

      if (outcome === 'failed') {
        Alert.alert(
          t('common.somethingWentWrong'),
          t('screens.onboarding.downloadUnavailable'),
        );
        onFinish();
      }
    },
    [downloadCurated, onFinish, t],
  );

  if (isDone) {
    return (
      <View
        style={[
          styles.doneContainer,
          {
            backgroundColor: colors.surface,
            paddingBottom: insets.bottom + Spacings.lg,
          },
        ]}
      >
        <View style={styles.doneContent}>
          <PlatformIcon
            iosIconName="checkmark.circle.fill"
            androidIconName="check_circle"
            size={44}
            color={colors.successSurface}
          />
          <Text variant="h1" style={styles.doneTitle}>
            {t('screens.onboarding.doneTitle')}
          </Text>
          <Text
            variant="body1"
            style={[styles.doneSubtitle, { color: colors.onSurfaceVariant }]}
          >
            {t('screens.onboarding.doneSubtitle')}
          </Text>
        </View>
        <Button
          title={t('screens.onboarding.start')}
          testID="onboarding-start-button"
          onPress={onFinish}
        />
      </View>
    );
  }

  if (isDownloading) {
    return (
      <OnboardingStep
        header={t('screens.onboarding.downloadingHeader')}
        title={t('screens.onboarding.downloadingTitle')}
        subtitle={t('screens.onboarding.downloadingSubtitle')}
        footer={
          <Button
            title={t('common.cancel')}
            testID="onboarding-cancel-button"
            variant="secondary"
            onPress={cancel}
            style={styles.cancelButton}
          />
        }
      >
        <View style={styles.progressContainer}>
          <Text variant="body2" bold style={styles.progressLabel}>
            {t('screens.onboarding.downloadProgress', {
              percent: Math.round(Math.min(progress, 1) * 100),
            })}
          </Text>
          <ProgressBar progress={progress} />
        </View>
      </OnboardingStep>
    );
  }

  return (
    <OnboardingStep
      header={t('screens.onboarding.voiceHeader')}
      title={t('screens.onboarding.modalityTitle')}
      subtitle={t('screens.onboarding.modalitySubtitle')}
    >
      <OnboardingCard
        icon={
          <View style={styles.choiceIcon}>
            <PlatformIcon
              iosIconName="text.bubble"
              androidIconName="chat"
              size={CHOICE_ICON_SIZE}
              color={colors.primary}
            />
          </View>
        }
        title={t('screens.onboarding.textOnly')}
        sizeGB={downloadSizeGB(curatedTextModels)}
        small
        testID="onboarding-text-only-button"
        onPress={() => download(curatedTextModels)}
      />
      <OnboardingCard
        icon={
          <View style={styles.choiceIcon}>
            <PlatformIcon
              iosIconName="waveform"
              androidIconName="graphic_eq"
              size={CHOICE_ICON_SIZE}
              color={colors.primary}
            />
          </View>
        }
        title={t('screens.onboarding.textAndVoice')}
        sizeGB={downloadSizeGB(curatedVoiceModels)}
        small
        testID="onboarding-text-voice-button"
        onPress={() => download(curatedVoiceModels)}
      />
    </OnboardingStep>
  );
};
