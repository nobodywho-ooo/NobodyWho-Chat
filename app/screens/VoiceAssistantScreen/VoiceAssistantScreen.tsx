import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useDrawerStatus } from '@react-navigation/drawer';
import { IconButton, PlatformIcon, Text, VoicePreferences } from 'components';
import { useTheme } from 'context';
import {
  AssistantConfig,
  DEFAULT_ASSISTANT_CONFIG,
  getAppState,
  setAppState,
} from 'database';
import { useAppState, useStyled } from 'hooks';
import { haptics } from 'helpers';

import { VoiceOrb, VoiceSetup } from './components';
import { useOrbLevels, useVoiceConversation, type VoiceStatus } from './hooks';

import styles from './VoiceAssistantScreen.styles';

interface VoiceAssistantScreenProps {
  onCloseDrawer: () => void;
}

const STOPPABLE_STATUSES: VoiceStatus[] = ['listening', 'speaking'];

const NOT_STOPPABLE_STATUSES: VoiceStatus[] = [
  'transcribing',
  'thinking',
  'synthesizing',
];

export const VoiceAssistantScreen: React.FC<VoiceAssistantScreenProps> = ({
  onCloseDrawer,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { width } = useWindowDimensions();
  const theme = useTheme();

  const orbSize = Math.min(width * 0.7, 300);
  const isDrawerOpen = useDrawerStatus() === 'open';

  const [showPreferences, setShowPreferences] = useState(false);

  const assistantConfig =
    useAppState().assistantConfig ?? DEFAULT_ASSISTANT_CONFIG;

  const savePreference = useCallback((patch: Partial<AssistantConfig>) => {
    setAppState({
      assistantConfig: {
        ...(getAppState().assistantConfig ?? DEFAULT_ASSISTANT_CONFIG),
        ...patch,
      },
    });
  }, []);

  const orb = useOrbLevels({ active: isDrawerOpen });
  const { status, voiceAssistantStatus, isBusy, hasAnswered, toggle } =
    useVoiceConversation({
      orb,
      active: isDrawerOpen,
      onPermissionDenied: () =>
        Alert.alert(
          t('components.inputBar.microphoneDeniedTitle'),
          t('components.inputBar.microphoneDeniedMessage'),
        ),
    });

  const isReady = status !== 'unavailable';
  const isStoppable = STOPPABLE_STATUSES.includes(status);
  const isProcessing = NOT_STOPPABLE_STATUSES.includes(status);

  const canOpenPreferences = status === 'idle' && !hasAnswered;

  useEffect(() => {
    if (!canOpenPreferences) {
      setShowPreferences(false);
    }
  }, [canOpenPreferences]);

  const accessibilityLabel = isStoppable
    ? t('screens.voiceAssistant.stop')
    : t('screens.voiceAssistant.start');

  const micButtonColor = isStoppable
    ? colors.ctaContentSecondary
    : colors.ctaContentPrimary;
  const micButtonBackgroundColorStyle = {
    backgroundColor: isStoppable
      ? colors.ctaSurfaceSecondary
      : colors.ctaSurfacePrimary,
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <IconButton
          icon={{ iosIconName: 'xmark', androidIconName: 'close' }}
          accessibilityLabel={t('screens.voiceAssistant.close')}
          onPress={
            showPreferences ? () => setShowPreferences(false) : onCloseDrawer
          }
        />
        <Text variant="h3" bold numberOfLines={1} style={styles.headerTitle}>
          {t('screens.voiceAssistant.title')}
        </Text>
        {canOpenPreferences && !showPreferences ? (
          <IconButton
            icon={{ iosIconName: 'gearshape', androidIconName: 'settings' }}
            accessibilityLabel={t('screens.voiceAssistant.preferences')}
            onPress={() => setShowPreferences(true)}
          />
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {showPreferences ? (
        <ScrollView
          style={styles.preferencesContainer}
          contentContainerStyle={styles.preferencesContent}
        >
          <VoicePreferences
            voice={assistantConfig.ttsVoice}
            language={assistantConfig.ttsLanguage}
            onChange={savePreference}
          />
        </ScrollView>
      ) : (
        <>
          <View style={styles.bodyContainer}>
            <VoiceOrb
              levels={orb.levels}
              size={orbSize}
              color={colors.primary}
              dark={theme === 'dark'}
              // Also paused while the drawer is shut: this screen is always
              // mounted, and an unpaused orb rebuilds and re-records its whole
              // Skia picture every frame, off screen, for as long as the app runs.
              paused={!isReady || !isDrawerOpen}
            />

            {isReady ? (
              <View style={styles.captionsContainer}>
                <Text variant="body1" bold style={styles.statusText}>
                  {t(`screens.voiceAssistant.status.${status}`)}
                </Text>
              </View>
            ) : (
              <VoiceSetup status={voiceAssistantStatus} />
            )}
          </View>

          {isReady && (
            <View style={styles.actionContainer}>
              {isProcessing ? (
                <View style={styles.buttonContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    haptics.medium();
                    toggle();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ busy: isBusy }}
                  accessibilityLabel={accessibilityLabel}
                  style={[
                    styles.buttonContainer,
                    micButtonBackgroundColorStyle,
                  ]}
                >
                  <PlatformIcon
                    iosIconName={isStoppable ? 'stop.fill' : 'mic.fill'}
                    androidIconName={isStoppable ? 'stop' : 'mic'}
                    size={30}
                    color={micButtonColor}
                  />
                </Pressable>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
};
