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

import { VoiceOrb } from './components';
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

  const orb = useOrbLevels();
  const { status, readiness, isBusy, toggle } = useVoiceConversation({
    orb,
    active: isDrawerOpen,
    onPermissionDenied: () =>
      Alert.alert(
        t('components.inputBar.microphoneDeniedTitle'),
        t('components.inputBar.microphoneDeniedMessage'),
      ),
  });

  const isReady = status !== 'unavailable';
  const isActive = ACTIVE_STATUSES.includes(status);
  const showLoader = LOADING_STATUSES.includes(status);

  const renderChecklistRow = (loaded: boolean, label: string) => (
    <View style={styles.setupRowContainer}>
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
          paused={!isReady}
        />

        {isReady ? (
          <View style={styles.captionsContainer}>
            <Text variant="body1" bold style={styles.statusText}>
              {t(`screens.voiceAssistant.status.${status}`)}
            </Text>
            {showLoader && <ActivityIndicator color={colors.primary} />}
          </View>
        ) : (
          <View style={styles.setupContainer}>
            <Text variant="body1" bold style={styles.setupTitle}>
              {t('screens.voiceAssistant.setup.title')}
            </Text>
            <Text
              variant="body2"
              style={[
                styles.setupDescription,
                { color: colors.onSurfaceVariant },
              ]}
            >
              {t('screens.voiceAssistant.setup.description')}
            </Text>
            <View style={styles.setupChecklistContainer}>
              {renderChecklistRow(
                readiness.chat,
                t('screens.voiceAssistant.setup.chat'),
              )}
              {renderChecklistRow(
                readiness.stt,
                t('screens.voiceAssistant.setup.stt'),
              )}
              {renderChecklistRow(
                readiness.tts,
                t('screens.voiceAssistant.setup.tts'),
              )}
            </View>
            <Text
              variant="caption"
              style={[styles.setupHint, { color: colors.onSurfaceVariant }]}
            >
              {t('screens.voiceAssistant.setup.hint')}
            </Text>
          </View>
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
            accessibilityLabel={
              isActive
                ? t('screens.voiceAssistant.stop')
                : t('screens.voiceAssistant.start')
            }
            style={[
              styles.buttonContainer,
              { backgroundColor: colors.primary },
            ]}
          >
            <PlatformIcon
              iosIconName={status !== 'idle' ? 'stop.fill' : 'mic.fill'}
              androidIconName={status !== 'idle' ? 'stop' : 'mic'}
              size={30}
              color={colors.ctaContentPrimary}
            />
          </Pressable>
        </View>
      )}
    </View>
  );
};
