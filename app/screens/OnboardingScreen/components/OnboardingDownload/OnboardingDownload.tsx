import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { curatedOnboardingModels, log, progressPercent } from 'helpers';
import { useKeepAwakeWhile, useStyled } from 'hooks';
import { getModelById } from 'repositories';
import { Spacings } from 'style';
import { Button, PlatformIcon, ProgressBar, Text, EdgeGlow } from 'components';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { OnboardingDownloadParams } from '../../Onboarding.types';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useOnboardingHeader } from '../../hooks/useOnboardingHeader';
import {
  useDownloadGlowOpacity,
  useDownloadPulses,
} from '../../hooks/useDownloadPulses';
import { OnboardingStep } from '../OnboardingStep/OnboardingStep';

import { ONBOARDING_PADDING_HORIZONTAL } from '../../Onboarding.styles';
import styles from './OnboardingDownload.styles';

export const OnboardingDownload: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<OnboardingDownloadParams>();
  const { t } = useTranslation();
  const { colors } = useStyled();
  const insets = useSafeAreaInsets();
  const { onFinish, curatedModels } = useOnboarding();
  const modelId = Number(params.modelId);
  const { setup } = params;

  const [isDone, setIsDone] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const { isLoaded, progress, downloadCurated, cancel } = curatedModels;
  const glowLevels = useDownloadPulses(progress);
  const glowOpacity = useDownloadGlowOpacity(progress);
  useKeepAwakeWhile(!isDone && !isLeaving);

  useOnboardingHeader(!isLeaving);

  useEffect(() => {
    if (isLeaving) {
      router.back();
    }
  }, [isLeaving, router]);

  const hasStarted = useRef(false);

  useEffect(() => {
    if (!isLoaded || hasStarted.current) {
      return;
    }
    hasStarted.current = true;

    downloadCurated(curatedOnboardingModels(modelId, setup), {
      alertOnFailure: false,
    }).then(async outcome => {
      if (outcome === 'done') {
        setIsDone(true);
      }

      if (outcome === 'inProgress') {
        onFinish();
      }

      if (outcome === 'failed') {
        const chatModel = await getModelById(modelId).catch(error => {
          log('OnboardingDownload getModelById', error);
          return undefined;
        });

        if (chatModel !== undefined) {
          Alert.alert(
            t('screens.models.downloadFailedTitle'),
            t('screens.onboarding.voiceUnavailable'),
          );
          setIsDone(true);
          return;
        }

        Alert.alert(
          t('common.somethingWentWrong'),
          t('screens.onboarding.downloadUnavailable'),
        );
        onFinish();
      }

      if (outcome === 'notEnoughSpace') {
        setIsLeaving(true);
      }
    });
  }, [isLoaded, downloadCurated, modelId, setup, onFinish, t]);

  // Leaves only once the rows are gone: picking again right away must not find
  // the cancelled downloads still in progress.
  const handleCancel = useCallback(async () => {
    await cancel();
    setIsLeaving(true);
  }, [cancel]);

  if (isDone) {
    return (
      <View
        style={[
          styles.doneContainer,
          {
            backgroundColor: colors.surface,
            paddingBottom: insets.bottom + Spacings.lg,
            paddingLeft: insets.left + ONBOARDING_PADDING_HORIZONTAL,
            paddingRight: insets.right + ONBOARDING_PADDING_HORIZONTAL,
          },
        ]}
      >
        <View style={styles.doneColumn}>
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
      </View>
    );
  }

  return (
    <OnboardingStep
      header={t('screens.onboarding.downloadingHeader')}
      title={t('screens.onboarding.downloadingTitle')}
      subtitle={t('screens.onboarding.downloadingSubtitle')}
      background={
        <EdgeGlow edge="top" levels={glowLevels} opacity={glowOpacity} />
      }
      footer={
        <Button
          title={t('common.cancel')}
          testID="onboarding-cancel-button"
          variant="secondary"
          onPress={handleCancel}
          style={styles.cancelButton}
        />
      }
    >
      <View style={styles.progressContainer}>
        <Text variant="body2" bold style={styles.progressLabel}>
          {t('screens.onboarding.downloadProgress', {
            percent: progressPercent(progress),
          })}
        </Text>
        <ProgressBar progress={progress} />
      </View>
    </OnboardingStep>
  );
};
