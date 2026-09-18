import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { stripThinkingBlocks } from 'helpers';
import { Spacings } from 'style';
import { useStyled } from 'hooks';

import { PlatformIcon } from '../../PlatformIcon/PlatformIcon';

interface AudioSpeakerButtonProps {
  isLoading: boolean;
  isPlaying: boolean;
  messageId: string;
  content: string;
  onPlay?: (messageId: string, text: string) => void;
  onStop?: () => void;
}

export const AudioSpeakerButton: React.FC<AudioSpeakerButtonProps> = ({
  isLoading,
  isPlaying,
  messageId,
  content,
  onPlay,
  onStop,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  if (isLoading) {
    return (
      <ActivityIndicator
        size="small"
        style={styles.spinner}
        color={colors.onSurfaceVariant}
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(
        isPlaying
          ? 'components.messageListItem.stopAudio'
          : 'components.messageListItem.playAudio',
      )}
      hitSlop={8}
      onPress={() =>
        isPlaying
          ? onStop?.()
          : onPlay?.(messageId, stripThinkingBlocks(content))
      }
      style={({ pressed }) => [pressed && styles.buttonPressed]}
    >
      <PlatformIcon
        iosIconName={isPlaying ? 'stop.circle.fill' : 'speaker.wave.2'}
        androidIconName={isPlaying ? 'stop_circle' : 'volume_up'}
        size={Spacings.lg}
        color={colors.onSurfaceVariant}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  spinner: {
    height: Spacings.lg,
    width: Spacings.lg,
  },
  buttonPressed: {
    opacity: 0.6,
  },
});
