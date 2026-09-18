import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { log, synthesizeSpeech } from 'helpers';
import { AiModelState, useAiService } from 'services';

interface TtsPlayback {
  loadingId: string | null;
  playingId: string | null;
  play: (messageId: string, text: string) => Promise<void>;
  stop: () => void;
}

const PLAYBACK_FILE = 'tts-playback.wav';

// Drives the assistant "read aloud" button: synthesizes a message with the
// loaded TTS model, writes the WAV to disk and plays it, tracking which message
// is loading vs. playing so the list can render the right affordance. Lifted to
// the screen (rather than living per-row) so a single audio player is shared —
// starting one message stops any other.
export const useTtsPlayback = (): TtsPlayback => {
  const busyRef = useRef(false);
  const generationRef = useRef(0);
  const { slots, ttsState, ttsArchitecture } = useAiService();
  const { borrow: borrowTts } = slots.tts;
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (status.didJustFinish) {
      setPlayingId(null);
    }
  }, [status.didJustFinish]);

  const stop = useCallback(() => {
    generationRef.current += 1;
    try {
      player.pause();
    } catch (error) {
      log('useTtsPlayback stop', error);
    }
    setPlayingId(null);
  }, [player]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
    };
  }, []);

  const play = useCallback(
    async (messageId: string, text: string) => {
      if (busyRef.current) {
        return;
      }
      if (ttsState !== AiModelState.Ready) {
        return;
      }

      busyRef.current = true;
      const generation = ++generationRef.current;
      setLoadingId(messageId);
      try {
        const wav = await borrowTts(engine =>
          synthesizeSpeech(
            engine,
            ttsArchitecture,
            text,
            () => generation === generationRef.current,
          ),
        );

        if (wav === undefined || generation !== generationRef.current) {
          return; // Stopped or unmounted while synthesizing => do nothing
        }

        const file = new File(Paths.cache, PLAYBACK_FILE);
        file.write(wav);

        // replace() reloads the source from disk (the file was just rewritten),
        // so reusing the same path still plays the fresh audio.
        player.replace({ uri: file.uri });
        setPlayingId(messageId);
        player.play();
      } catch (error) {
        setPlayingId(null);
        log('useTtsPlayback play', error);
      } finally {
        setLoadingId(null);
        busyRef.current = false;
      }
    },
    [borrowTts, ttsState, ttsArchitecture, player],
  );

  return { loadingId, playingId, play, stop };
};
