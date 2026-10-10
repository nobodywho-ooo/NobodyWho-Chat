import React, { useCallback } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, ProgressBar, Text } from 'components';
import { useStyled } from 'hooks';
import { Spacings } from 'style';

import {
  ModelRequirement,
  TEXT_REQUIREMENTS,
  useMissingModelDownloads,
  VOICE_REQUIREMENTS,
} from '../ModelsScreen/useMissingModelDownloads';
import styles from './OnboardingScreen.styles';

interface OnboardingScreenProps {
  onFinish: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onFinish,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const insets = useSafeAreaInsets();
  const { isDownloading, progress, downloadMissing, cancel } =
    useMissingModelDownloads();

  const download = useCallback(
    async (requirements: readonly ModelRequirement[]) => {
      const outcome = await downloadMissing(requirements, {
        alertOnFailure: false,
      });

      // Most likely offline: let the user into the app rather than stall on
      // onboarding; they can download from the models screen later.
      if (outcome === 'failed') {
        Alert.alert(
          t('common.somethingWentWrong'),
          t('screens.onboarding.downloadUnavailable'),
        );
      }
      if (outcome === 'done' || outcome === 'failed') {
        onFinish();
      }
    },
    [downloadMissing, onFinish, t],
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + Spacings.lg,
        },
      ]}
    >
      <Text variant="h1" style={styles.header}>
        {t('screens.onboarding.header')}
      </Text>
      <View>
        <Text variant="h2">{t('screens.onboarding.title')}</Text>
        <Text
          variant="body1"
          style={[styles.subtitle, { color: colors.onSurfaceVariant }]}
        >
          {t('screens.onboarding.subtitle')}
        </Text>
        {isDownloading ? (
          <View style={styles.progressContainer}>
            <Text variant="body2" bold style={styles.progressLabel}>
              {t('screens.onboarding.downloadProgress', {
                percent: Math.round(Math.min(progress, 1) * 100),
              })}
            </Text>
            <ProgressBar progress={progress} />
          </View>
        ) : (
          <View style={styles.choicesContainer}>
            <Button
              title={t('screens.onboarding.textOnly')}
              testID="onboarding-text-only-button"
              icon={{ iosIconName: 'text.bubble', androidIconName: 'chat' }}
              onPress={() => download(TEXT_REQUIREMENTS)}
            />
            <Button
              title={t('screens.onboarding.textAndVoice')}
              testID="onboarding-text-voice-button"
              icon={{ iosIconName: 'waveform', androidIconName: 'graphic_eq' }}
              onPress={() => download(VOICE_REQUIREMENTS)}
            />
          </View>
        )}
        <Button
          title={t(isDownloading ? 'common.cancel' : 'screens.onboarding.skip')}
          testID="onboarding-secondary-button"
          variant="secondary"
          onPress={isDownloading ? cancel : onFinish}
          style={styles.secondaryButton}
        />
      </View>
    </View>
  );
};
