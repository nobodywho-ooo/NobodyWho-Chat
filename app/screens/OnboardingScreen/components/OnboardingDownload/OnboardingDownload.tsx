import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, PlatformIcon, ProgressBar, Text } from 'components';
import { curatedOnboardingModels } from 'helpers';
import { useCuratedModels, useStyled } from 'hooks';
import { Spacings } from 'style';

import { OnboardingScreenProps } from '../../Onboarding.types';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useOnboardingHeader } from '../../hooks/useOnboardingHeader';
import { OnboardingStep } from '../OnboardingStep/OnboardingStep';

import styles from './OnboardingDownload.styles';

// Downloads what the previous step picked, locked in place until it is done.
// Cancel, or a download that doesn't fit, goes back to that step.
export const OnboardingDownload: React.FC<
  OnboardingScreenProps<'OnboardingDownload'>
> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const insets = useSafeAreaInsets();
  const { catalogue, onFinish } = useOnboarding();
  const { modelId, setup } = route.params;

  const [isDone, setIsDone] = useState(false);
  // The lock blocks going back too, so it is lifted before leaving.
  const [isLeaving, setIsLeaving] = useState(false);

  const { progress, downloadCurated, cancel } = useCuratedModels(catalogue);

  useOnboardingHeader(navigation, !isLeaving);

  useEffect(() => {
    if (isLeaving) {
      navigation.goBack();
    }
  }, [isLeaving, navigation]);

  // Once, on arrival: downloadCurated changes as the downloads progress.
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }
    hasStarted.current = true;

    downloadCurated(curatedOnboardingModels(modelId, setup), {
      alertOnFailure: false,
    }).then(outcome => {
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

      // The user was already told why; let them pick something smaller.
      if (outcome === 'notEnoughSpace') {
        setIsLeaving(true);
      }
    });
  }, [downloadCurated, modelId, setup, onFinish, t]);

  const handleCancel = useCallback(() => {
    cancel();
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
          onPress={handleCancel}
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
};
