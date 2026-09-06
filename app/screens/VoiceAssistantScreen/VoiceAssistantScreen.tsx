import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useDrawerStatus } from '@react-navigation/drawer';
import { IconButton, PlatformIcon, Text } from 'components';
import { useTheme } from 'context';
import { useStyled } from 'hooks';
import { haptics } from 'helpers';

import { VoiceOrb, VoiceSetup } from './components';
import { useOrbLevels, useVoiceConversation, type VoiceStatus } from './hooks';

import styles from './VoiceAssistantScreen.styles';

interface VoiceAssistantScreenProps {
  onCloseDrawer: () => void;
}

// The two phases the button can actually interrupt: the user is talking, or the
// answer is playing back. In both the button reads "stop" rather than "start".
const STOPPABLE_STATUSES: VoiceStatus[] = ['listening', 'speaking'];

// The phases that run to completion: transcription, generation, and the speech
// synthesis that follows it — each a native call with nothing to interrupt.
// 'thinking' covers synthesis too, since the status only flips to 'speaking'
// once the finished audio starts playing. The button is replaced by a spinner
// throughout, rather than offering a stop that couldn't be honoured.
const PROCESSING_STATUSES: VoiceStatus[] = ['transcribing', 'thinking'];

export const VoiceAssistantScreen: React.FC<VoiceAssistantScreenProps> = ({
  onCloseDrawer,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { width } = useWindowDimensions();
  const theme = useTheme();

  const orbSize = Math.min(width * 0.7, 300);
  const isDrawerOpen = useDrawerStatus() === 'open';

  const orb = useOrbLevels({ active: isDrawerOpen });
  const { status, voiceAssistantStatus, isBusy, toggle } = useVoiceConversation(
    {
      orb,
      active: isDrawerOpen,
      onPermissionDenied: () =>
        Alert.alert(
          t('components.inputBar.microphoneDeniedTitle'),
          t('components.inputBar.microphoneDeniedMessage'),
        ),
    },
  );

  const isReady = status !== 'unavailable';
  const isStoppable = STOPPABLE_STATUSES.includes(status);
  const isProcessing = PROCESSING_STATUSES.includes(status);

  const accessibilityLabel = isStoppable
    ? t('screens.voiceAssistant.stop')
    : t('screens.voiceAssistant.start');

  // Stopping is the secondary action; starting (from idle, or again after an
  // error) is the primary one.
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
          onPress={onCloseDrawer}
        />
        <Text variant="h3" bold>
          {t('screens.voiceAssistant.title')}
        </Text>
        <View style={styles.emptyContainerStyle} />
        {/* <IconButton
          icon={{ iosIconName: 'gearshape', androidIconName: 'settings' }}
          onPress={() => {}}
        /> */}
      </View>

      <View style={styles.bodyContainer}>
        <VoiceOrb
          levels={orb.levels}
          size={orbSize}
          color={colors.primary}
          dark={theme === 'dark'}
          // Also paused while the drawer is shut: this screen is always mounted,
          // and an unpaused orb rebuilds and re-records its whole Skia picture
          // every frame, off screen, for as long as the app runs.
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
            // Laid out in the same box as the button so swapping the two doesn't
            // move anything else on screen.
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
              style={[styles.buttonContainer, micButtonBackgroundColorStyle]}
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
    </View>
  );
};
