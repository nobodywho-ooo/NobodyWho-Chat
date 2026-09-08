import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { log, synthesizeSpeech } from 'helpers';
import { AiModelState, useAiService } from 'services';

interface TtsPlayback {
  loadingIndex: number | null;
  playingIndex: number | null;
  play: (index: number, text: string) => Promise<void>;
  stop: () => void;
}

const PLAYBACK_FILE = 'tts-playback.wav';

// Drives the assistant "read aloud" button: synthesizes a message with the
// loaded TTS model, writes the WAV to disk and plays it, tracking which row is
// loading vs. playing so the list can render the right affordance. Lifted to
// the screen (rather than living per-row) so a single audio player is shared —
// starting one message stops any other.
export const useTtsPlayback = (): TtsPlayback => {
  const busyRef = useRef(false);
  const generationRef = useRef(0);
  const { ttsState, ttsArchitecture, borrowTts } = useAiService();
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (status.didJustFinish) {
      setPlayingIndex(null);
    }
  }, [status.didJustFinish]);

  const stop = useCallback(() => {
    generationRef.current += 1;
    try {
      player.pause();
    } catch (error) {
      log('useTtsPlayback stop', error);
    }
    setPlayingIndex(null);
  }, [player]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
    };
  }, []);

  const play = useCallback(
    async (index: number, text: string) => {
      if (busyRef.current) {
        return;
      }
      if (ttsState !== AiModelState.Ready) {
        return;
      }

      busyRef.current = true;
      const generation = ++generationRef.current;
      setLoadingIndex(index);
      try {
        const wav = await borrowTts(engine =>
          synthesizeSpeech(engine, ttsArchitecture, text),
        );

        if (wav === undefined || generation !== generationRef.current) {
          return; // Stopped or unmounted while synthesizing => do nothing
        }

        const file = new File(Paths.cache, PLAYBACK_FILE);
        file.write(wav);

        // replace() reloads the source from disk (the file was just rewritten),
        // so reusing the same path still plays the fresh audio.
        player.replace({ uri: file.uri });
        setPlayingIndex(index);
        player.play();
      } catch (error) {
        setPlayingIndex(null);
        log('useTtsPlayback play', error);
      } finally {
        setLoadingIndex(null);
        busyRef.current = false;
      }
    },
    [borrowTts, ttsState, ttsArchitecture, player],
  );

  return { loadingIndex, playingIndex, play, stop };
};
