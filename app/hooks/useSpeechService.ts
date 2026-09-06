import { useCallback, useMemo, useRef } from 'react';
import { VoiceActivityDetectionEvent } from 'react-native-nobodywho';
import { log, resamplePcm } from 'helpers';
import { AiModelState, useAiService, VAD_SAMPLE_RATE } from 'services';

export interface SpeechService {
  enabled: boolean;
  reset: () => void;
  /**
   * Hand over the newest slice of microphone audio as it arrives — one call per
   * buffer, each carrying only the samples recorded since the previous call.
   * Don't re-send the whole recording: the detector accumulates the turn itself,
   * and would hear the same words over and over.
   *
   * Returns false while the person is still talking, or hasn't started yet, and
   * true on the single call where the detector concludes they have finished
   * speaking. That `true` is the cue to close the microphone and transcribe.
   */
  push: (chunk: Int16Array, sampleRate: number) => boolean;

  /**
   * Take back the part of the recording where someone was actually speaking —
   * starting a moment before the first word, so nothing is clipped, and ending
   * where they stopped, with the silence on either side cut away. This is the
   * audio to hand to speech-to-text: less of it to transcribe, and no quiet
   * stretches for the model to invent words in.
   *
   * Taking the speech clears it, leaving the detector ready for the next turn.
   */
  takeSpeechToTranscribe: () => Int16Array | undefined;
}

const DISABLED_SERVICE: Omit<SpeechService, 'enabled'> = {
  reset: () => undefined,
  push: () => false,
  takeSpeechToTranscribe: () => undefined,
};

export const useSpeechService = (): SpeechService => {
  const { vad, vadState } = useAiService();

  // Set when push() throws, so one failure degrades the turn to manual stop
  // rather than throwing once per recorded buffer for the rest of the session.
  const failedRef = useRef(false);

  const ready = vadState === AiModelState.Ready;

  const reset = useCallback(() => {
    failedRef.current = false;

    try {
      vad.current?.finish();
    } catch (error) {
      log('useSpeechService reset', error);
    }
  }, [vad]);

  const push = useCallback(
    (chunk: Int16Array, sampleRate: number): boolean => {
      const vadInstance = vad.current;

      if (!vadInstance || failedRef.current || chunk.length === 0) {
        return false;
      }

      try {
        const pcm = resamplePcm(chunk, sampleRate, VAD_SAMPLE_RATE);
        const event = vadInstance.push(pcm);

        return event === VoiceActivityDetectionEvent.SpeechEnded;
      } catch (error) {
        failedRef.current = true;
        log('useSpeechService push', error, { capture: true });

        return false;
      }
    },
    [vad],
  );

  const takeSpeechToTranscribe = useCallback((): Int16Array | undefined => {
    const vadInstance = vad.current;

    if (!vadInstance || failedRef.current) {
      return undefined;
    }

    try {
      const speech = vadInstance.finish();

      return speech.length > 0 ? Int16Array.from(speech) : undefined;
    } catch (error) {
      log('useSpeechService finish', error, { capture: true });
      return undefined;
    }
  }, [vad]);

  return useMemo(() => {
    if (ready) {
      return { enabled: true, reset, push, takeSpeechToTranscribe };
    }

    return { enabled: false, ...DISABLED_SERVICE };
  }, [ready, reset, push, takeSpeechToTranscribe]);
};
