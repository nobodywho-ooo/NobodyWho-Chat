import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { log, messageDocumentUri } from 'helpers';
import { useStyled } from 'hooks';
import { Spacings } from 'style';

import { PlatformIcon } from '../../PlatformIcon/PlatformIcon';
import { Waveform } from './Waveform';

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
        if (isPlaying) {
          player.pause();
        }
      } catch (error) {
        log('AudioAttachment unmount pause', error);
      }
    };
  }, [player, isPlaying]);

  return (
    <View
      style={[
        styles.containter,
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

const styles = StyleSheet.create({
  containter: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacings.sm,
    paddingHorizontal: Spacings.md,
    paddingVertical: Spacings.sm,
    borderRadius: 12,
    borderWidth: 1,
  },
  audioPlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPlayButtonPressed: {
    opacity: 0.6,
  },
});
