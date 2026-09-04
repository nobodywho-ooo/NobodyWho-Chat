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

// Statuses that put the button into "stop / cancel" mode rather than "start".
const ACTIVE_STATUSES: VoiceStatus[] = [
  'listening',
  'transcribing',
  'thinking',
  'speaking',
];

const LOADING_STATUSES: VoiceStatus[] = ['transcribing', 'thinking'];

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
  const isIdle = status === 'idle';
  const isActive = ACTIVE_STATUSES.includes(status);
  const showLoader = LOADING_STATUSES.includes(status);

  const accessibilityLabel = isActive
    ? t('screens.voiceAssistant.stop')
    : t('screens.voiceAssistant.start');

  const micButtonColor = isIdle
    ? colors.ctaContentPrimary
    : colors.ctaContentSecondary;
  const micButtonBackgroundColorStyle = {
    backgroundColor: isIdle
      ? colors.ctaSurfacePrimary
      : colors.ctaSurfaceSecondary,
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
            {showLoader && <ActivityIndicator color={colors.primary} />}
          </View>
        ) : (
          <VoiceSetup status={voiceAssistantStatus} />
        )}
      </View>

      {isReady && (
        <View style={styles.micContainer}>
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
              iosIconName={status !== 'idle' ? 'stop.fill' : 'mic.fill'}
              androidIconName={status !== 'idle' ? 'stop' : 'mic'}
              size={30}
              color={micButtonColor}
            />
          </Pressable>
        </View>
      )}
    </View>
  );
};
