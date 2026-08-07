import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { log, synthesizeChunked } from 'helpers';
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
  const { tts, ttsState, ttsArchitecture } = useAiService();
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
    try {
      player.pause();
    } catch (error) {
      log('useTtsPlayback stop', error);
    }
    setPlayingIndex(null);
  }, [player]);

  const play = useCallback(
    async (index: number, text: string) => {
      if (busyRef.current) {
        return;
      }
      if (ttsState !== AiModelState.Ready || !tts.current) {
        return;
      }

      busyRef.current = true;
      setLoadingIndex(index);
      try {
        // Kokoro rejects synthesize() calls over its phoneme cap, so its text
        // is chunked and the WAVs stitched together; Supertonic chunks
        // internally, so one call handles a whole message.
        const wav =
          ttsArchitecture === 'kokoro'
            ? await synthesizeChunked(tts.current, text)
            : await tts.current.synthesize(text);

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
    [tts, ttsState, ttsArchitecture, player],
  );

  return { loadingIndex, playingIndex, play, stop };
};
