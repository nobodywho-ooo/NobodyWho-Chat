import { useCallback, useEffect, useRef, useState } from 'react';
import { requestRecordingPermissionsAsync, useAudioStream } from 'expo-audio';
import { acquireRecordingMode, cleanTranscript, concatPcm, log } from 'helpers';
import { useSpeechService } from 'hooks';
import { AiModelState, useAiService, VAD_SAMPLE_RATE } from 'services';

interface SttTranscription {
  isRecording: boolean;
  isTranscribing: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  cancelRecording: () => void;
}

interface SttTranscriptionOptions {
  onTranscribed: (text: string) => void;
  onPermissionDenied?: () => void;
}

// Whisper works at 16 kHz; the engine resamples internally, so requesting the
// target rate up front just keeps the captured buffers small.
const TARGET_SAMPLE_RATE = 16000;

// Drives the input-bar dictation mic: records the microphone as mono int16 PCM
// with the loaded Whisper model and hands the transcription back to the screen
// to drop into the text field. When a voice activity detection model is loaded
// too, the recording also ends itself once the user stops talking, instead of
// waiting for a second tap.
export const useSttTranscription = ({
  onTranscribed,
  onPermissionDenied,
}: SttTranscriptionOptions): SttTranscription => {
  const busyRef = useRef(false);
  const { sttState, borrowStt } = useAiService();

  // cancelRecording is defined below but has to be reachable from the preempt callback
  const cancelRecordingRef = useRef<() => void>(() => undefined);

  // The detector is shared with the voice assistant. If that takes it mid-turn,
  // this recording can no longer end itself — its buffers stop being
  // accumulated — so close the mic rather than leave it open indefinitely.
  const speechService = useSpeechService({
    onPreempted: () => cancelRecordingRef.current(),
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Mirror the recording flag into a ref so the imperative callbacks below can
  // read it without listing `isRecording` as a dependency. That keeps them
  // stable across a start/stop: otherwise cancelRecording's identity would
  // change the instant recording begins, and the screen's reset effect — which
  // depends on cancelRecording — would re-run and cancel the recording it just
  // started.
  const isRecordingRef = useRef(false);
  const setRecording = useCallback((recording: boolean) => {
    isRecordingRef.current = recording;
    setIsRecording(recording);
  }, []);

  // Bumped by every stop and cancel. startRecording captures it and abandons
  // itself if it changed, because a cancel landing while it awaits the
  // permission prompt has no recording to stop yet — without this the mic opens
  // afterwards anyway, with no effect left to close it.
  const captureGeneration = useRef(0);

  // This hook's hold on the process-wide record-mode session, when it has one.
  const releaseModeRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const releaseRecordingMode = useCallback(async () => {
    const release = releaseModeRef.current;
    releaseModeRef.current = undefined;
    await release?.();
  }, []);

  // Captured PCM windows and the rate the hardware actually delivered. Refs, not
  // state, so the onBuffer callback appends without forcing a re-render per
  // buffer (many per second).
  const chunksRef = useRef<Int16Array[]>([]);
  const sampleRateRef = useRef(TARGET_SAMPLE_RATE);

  // stopRecording is defined below but has to be reachable from onBuffer, which
  // is what detects the end of speech. Kept in a ref so onBuffer doesn't have to
  // be redefined (and the auto-stop re-armed) on every render.
  const stopRecordingRef = useRef<() => void>(() => undefined);

  const onBuffer = useCallback(
    (buffer: { data: ArrayBuffer; sampleRate: number }) => {
      // slice() takes an owned copy by memcpy, so retaining the window can't be
      // affected by what the native side does with the buffer afterwards.
      // (Int16Array.from would go through the iterator protocol and materialise
      // a boxed array of every sample first — many times the cost, at ~10
      // buffers a second.)
      const chunk = new Int16Array(buffer.data).slice();
      chunksRef.current.push(chunk);
      sampleRateRef.current = buffer.sampleRate;

      // With a voice detection model loaded, the user falling silent ends the
      // dictation. Every buffer is fed to it — including the first few, which
      // land before `startRecording` has flipped the flag — so the speech it
      // keeps matches what was recorded; only acting on the result is gated.
      const speechEnded = speechService.push(chunk, buffer.sampleRate);

      if (speechEnded && isRecordingRef.current) {
        stopRecordingRef.current();
      }
    },
    [speechService],
  );

  const { stream } = useAudioStream({
    sampleRate: TARGET_SAMPLE_RATE,
    channels: 1,
    encoding: 'int16',
    onBuffer,
  });

  const startRecording = useCallback(async () => {
    if (busyRef.current || isRecordingRef.current) {
      return;
    }
    if (sttState !== AiModelState.Ready) {
      return;
    }

    const generation = captureGeneration.current;
    const abandoned = () => generation !== captureGeneration.current;

    busyRef.current = true;
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        onPermissionDenied?.();
        return;
      }

      if (abandoned()) {
        return;
      }

      chunksRef.current = [];
      sampleRateRef.current = TARGET_SAMPLE_RATE;
      speechService.reset();

      releaseModeRef.current = await acquireRecordingMode();

      if (abandoned()) {
        await releaseRecordingMode();
        return;
      }

      await stream.start();

      if (abandoned()) {
        stream.stop();
        await releaseRecordingMode();
        return;
      }

      setRecording(true);
    } catch (error) {
      log('useSttTranscription start', error);
      await releaseRecordingMode();
    } finally {
      busyRef.current = false;
    }
  }, [
    sttState,
    stream,
    onPermissionDenied,
    releaseRecordingMode,
    setRecording,
    speechService,
  ]);

  const stopRecording = useCallback(async () => {
    if (busyRef.current || !isRecordingRef.current) {
      return;
    }

    captureGeneration.current += 1;
    busyRef.current = true;
    try {
      stream.stop();
      setRecording(false);
      await releaseRecordingMode();

      const chunks = chunksRef.current;
      chunksRef.current = [];

      // Prefer what the detection model kept — the same speech with the silence
      // around it trimmed off, so Whisper transcribes less audio and doesn't
      // hallucinate words into the quiet. It comes back at that model's own
      // rate. Falls back to the unedited recording when no detection model is
      // loaded, or when it never settled on any speech (too short, too quiet).
      const speech = speechService.takeSpeechToTranscribe();
      const samples = speech ?? concatPcm(chunks);
      const sampleRate = speech ? VAD_SAMPLE_RATE : sampleRateRef.current;
      speechService.release();

      if (samples.length === 0 || sttState !== AiModelState.Ready) {
        return;
      }

      setIsTranscribing(true);

      const text = cleanTranscript(
        await borrowStt(instance =>
          instance.transcribePcm(samples, sampleRate).completed(),
        ),
      );

      if (text) {
        onTranscribed(text);
      }
    } catch (error) {
      log('useSttTranscription stop', error);
    } finally {
      setIsTranscribing(false);
      busyRef.current = false;
    }
  }, [
    sttState,
    borrowStt,
    stream,
    onTranscribed,
    releaseRecordingMode,
    setRecording,
    speechService,
  ]);

  // Republish the latest stopRecording for the auto-stop above. Assigning during
  // render (rather than in an effect) keeps it current even if a buffer arrives
  // before effects flush.
  stopRecordingRef.current = stopRecording;

  const cancelRecording = useCallback(() => {
    // Bumped unconditionally: a cancel landing while startRecording is still
    // awaiting the permission prompt has no recording to stop yet, but must
    // still stop that start from opening the microphone behind it.
    captureGeneration.current += 1;

    if (!isRecordingRef.current) {
      return;
    }
    try {
      stream.stop();
    } catch (error) {
      log('useSttTranscription cancel', error);
    }
    chunksRef.current = [];
    speechService.reset();
    speechService.release();
    setRecording(false);
    releaseRecordingMode();
  }, [stream, releaseRecordingMode, setRecording, speechService]);

  cancelRecordingRef.current = cancelRecording;

  // If the engine is torn down while recording (model switch, backgrounding),
  // stop the capture so the microphone is released instead of staying open with
  // no engine left to transcribe into.
  useEffect(() => {
    if (isRecording && sttState !== AiModelState.Ready) {
      cancelRecording();
    }
  }, [isRecording, sttState, cancelRecording]);

  return {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    cancelRecording,
  };
};
