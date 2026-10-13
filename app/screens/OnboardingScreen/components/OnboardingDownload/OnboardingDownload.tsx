import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, PlatformIcon, ProgressBar, Text } from 'components';
import { curatedOnboardingModels, log } from 'helpers';
import { useCuratedModels, useStyled } from 'hooks';
import { getModelById } from 'repositories';
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

  const { isLoaded, progress, downloadCurated, cancel } =
    useCuratedModels(catalogue);

  useOnboardingHeader(navigation, !isLeaving);

  useEffect(() => {
    if (isLeaving) {
      navigation.goBack();
    }
  }, [isLeaving, navigation]);

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
