import React, { useCallback, useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { log, messageDocumentUri } from 'helpers';
import { useStyled } from 'hooks';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import { Waveform } from './Waveform';

import styles from './MessageListItem.styles';

interface AudioAttachmentProps {
  path: string;
}

export const AudioAttachment: React.FC<AudioAttachmentProps> = ({ path }) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const player = useAudioPlayer({ uri: messageDocumentUri(path) });
  const status = useAudioPlayerStatus(player);
  const isPlaying = status.playing;

  const togglePlayback = useCallback(() => {
    try {
      if (isPlaying) {
        player.pause();
        return;
      }

      if (status.didJustFinish) {
        player.seekTo(0);
      }
      player.play();
    } catch (error) {
      log('AudioAttachment togglePlayback', error);
    }
  }, [isPlaying, status.didJustFinish, player]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch (error) {
        log('AudioAttachment unmount pause', error);
      }
    };
  }, [player]);

  return (
    <View
      style={[
        styles.audioRow,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(
          isPlaying
            ? 'components.messageListItem.pauseAudio'
            : 'components.messageListItem.playAudio',
        )}
        hitSlop={8}
        onPress={togglePlayback}
        style={({ pressed }) => [
          styles.audioPlayButton,
          { backgroundColor: colors.ctaSurfacePrimary },
          pressed && styles.audioPlayButtonPressed,
        ]}
      >
        <PlatformIcon
          iosIconName={isPlaying ? 'pause.fill' : 'play.fill'}
          androidIconName={isPlaying ? 'pause' : 'play_arrow'}
          size={16}
          color={colors.ctaContentPrimary}
        />
      </Pressable>
      <Waveform color={colors.onSurfaceVariant} />
    </View>
  );
};
