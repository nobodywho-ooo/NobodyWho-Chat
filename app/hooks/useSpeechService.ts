import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VoiceActivityDetectionEvent } from 'react-native-nobodywho';
import { log, resamplePcm } from 'helpers';
import { AiModelState, useAiService, VAD_SAMPLE_RATE } from 'services';

export interface SpeechService {
  enabled: boolean;

  /**
   * Start a turn, taking the detector for this consumer and clearing whatever
   * the previous turn left in it. Any other consumer holding it is preempted
   * (see `onPreempted`).
   */
  reset: () => void;

  /** Give the detector back, so another consumer can take a turn on it. */
  release: () => void;

  /**
   * Hand over the newest slice of microphone audio as it arrives — one call per
   * buffer, each carrying only the samples recorded since the previous call.
   * Don't re-send the whole recording: the detector accumulates the turn itself,
   * and would hear the same words over and over.
   *
   * Returns false while the person is still talking, or hasn't started yet, and
   * true on the single call where the detector concludes they have finished
   * speaking. That `true` is the cue to close the microphone and transcribe.
   *
   * It can also never come back true: the detector only reports the end of
   * speech it confirmed the beginning of, so a turn it never hears start is a
   * turn it cannot end. Callers must bound the capture themselves — see
   * MAX_RECORDING_MS.
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

interface SpeechServiceOptions {
  // Called when another consumer takes the detector mid-turn. The right
  // response is to stop capturing: this consumer's audio is no longer being
  // accumulated, so its turn can never end itself.
  onPreempted?: () => void;
}

interface Holder {
  onPreempted?: () => void;
}

// The detector is a single native instance shared by both microphone features:
// the input bar's dictation and the voice assistant, which is always mounted as
// the right drawer's content. It accumulates one turn at a time and finish() is
// destructive, so two consumers pushing at once interleave two speakers into one
// turn, and whichever reads the result first takes the other's audio too.
//
// Ownership is therefore exclusive for the length of a turn. Starting a turn
// takes it from whoever held it — last starter wins, since that is the one the
// user just asked for — and the previous holder is told to stop capturing
// instead of being left recording into a detector that is no longer listening
// to it.
let owner: Holder | undefined;

const DISABLED_SERVICE: Omit<SpeechService, 'enabled'> = {
  reset: () => undefined,
  release: () => undefined,
  push: () => false,
  takeSpeechToTranscribe: () => undefined,
};

export const useSpeechService = (
  options: SpeechServiceOptions = {},
): SpeechService => {
  const { vad, vadState } = useAiService();

  // Latched when push() throws, so one failure degrades the turn rather than
  // throwing once per recorded buffer for the rest of the session. Mirrored
  // into state because `enabled` has to reflect it: reporting the service as
  // usable after it has broken leaves the voice assistant listening forever,
  // with a setup checklist claiming every model is loaded.
  const failedRef = useRef(false);
  const [failed, setFailed] = useState(false);

  // A fresh instance gets a fresh chance. A failure otherwise sticks: it means
  // the native detector is broken, and every later push would throw too.
  useEffect(() => {
    failedRef.current = false;
    setFailed(false);
  }, [vadState]);

  // Stable identity for this consumer, with the preempt callback kept current
  // so taking ownership never has to re-run on a re-render.
  const holderRef = useRef<Holder>({});
  holderRef.current.onPreempted = options.onPreempted;

  const ready = vadState === AiModelState.Ready && !failed;

  const release = useCallback(() => {
    if (owner === holderRef.current) {
      owner = undefined;
    }
  }, []);

  // Give the detector up if this consumer still holds it when it goes away.
  useEffect(() => release, [release]);

  const reset = useCallback(() => {
    const holder = holderRef.current;

    if (owner !== holder) {
      // Leave the detector unclaimed while the previous holder is told to stop,
      // and only then take it. Its stop path takes and releases the detector
      // itself (both consumers reset and release as they close the microphone),
      // so claiming it first would have it handed straight back to us mid-call
      // — leaving `owner` pointing at whoever ran last instead of at the turn
      // the user just asked for, and every push of that turn inert.
      const previous = owner;
      owner = undefined;
      previous?.onPreempted?.();
    }

    owner = holder;

    try {
      vad.current?.finish();
    } catch (error) {
      log('useSpeechService reset', error);
    }
  }, [vad]);

  const push = useCallback(
    (chunk: Int16Array, sampleRate: number): boolean => {
      const vadInstance = vad.current;

      if (
        !vadInstance ||
        owner !== holderRef.current ||
        failedRef.current ||
        chunk.length === 0
      ) {
        return false;
      }

      try {
        const pcm = resamplePcm(chunk, sampleRate, VAD_SAMPLE_RATE);
        const event = vadInstance.push(pcm);

        return event === VoiceActivityDetectionEvent.SpeechEnded;
      } catch (error) {
        failedRef.current = true;
        setFailed(true);
        log('useSpeechService push', error, { capture: true });

        return false;
      }
    },
    [vad],
  );

  const takeSpeechToTranscribe = useCallback((): Int16Array | undefined => {
    const vadInstance = vad.current;

    if (!vadInstance || owner !== holderRef.current || failedRef.current) {
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
      return { enabled: true, reset, release, push, takeSpeechToTranscribe };
    }

    return { enabled: false, ...DISABLED_SERVICE };
  }, [ready, reset, release, push, takeSpeechToTranscribe]);
};
