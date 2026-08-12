import { useCallback, useEffect, useRef, useState } from 'react';
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioStream,
} from 'expo-audio';
import { log } from 'helpers';
import { AiModelState, useAiService } from 'services';

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
// to drop into the text field.
export const useSttTranscription = ({
  onTranscribed,
  onPermissionDenied,
}: SttTranscriptionOptions): SttTranscription => {
  const busyRef = useRef(false);
  const { stt, sttState } = useAiService();
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

  // Captured PCM windows and the rate the hardware actually delivered. Refs, not
  // state, so the onBuffer callback appends without forcing a re-render per
  // buffer (many per second).
  const chunksRef = useRef<Int16Array[]>([]);
  const sampleRateRef = useRef(TARGET_SAMPLE_RATE);

  const onBuffer = useCallback(
    (buffer: { data: ArrayBuffer; sampleRate: number }) => {
      // Copy out of the native-owned ArrayBuffer, which is reused for the next
      // window; Int16Array.from makes an owned copy we can safely retain.
      chunksRef.current.push(Int16Array.from(new Int16Array(buffer.data)));
      sampleRateRef.current = buffer.sampleRate;
    },
    [],
  );

  const { stream } = useAudioStream({
    sampleRate: TARGET_SAMPLE_RATE,
    channels: 1,
    encoding: 'int16',
    onBuffer,
  });

  // Restore the shared audio session to playback-only so TTS read-aloud keeps
  // working after a dictation. Keep playsInSilentMode set: on iOS the audio mode
  // is replaced wholesale (not merged), so dropping it here would revert the
  // session to the .ambient category and mute read-aloud whenever the ringer/mute
  // switch is on. Best-effort — a failure here must not surface.
  const releaseRecordingMode = useCallback(async () => {
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch (error) {
      log('useSttTranscription release mode', error);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (busyRef.current || isRecordingRef.current) {
      return;
    }
    if (sttState !== AiModelState.Ready || !stt.current) {
      return;
    }

    busyRef.current = true;
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        onPermissionDenied?.();
        return;
      }

      chunksRef.current = [];
      sampleRateRef.current = TARGET_SAMPLE_RATE;

      // iOS needs the session switched to a record-capable category before the
      // input node can start; also keep it audible in silent mode.
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await stream.start();
      setRecording(true);
    } catch (error) {
      log('useSttTranscription start', error);
      await releaseRecordingMode();
    } finally {
      busyRef.current = false;
    }
  }, [sttState, stt, stream, onPermissionDenied, releaseRecordingMode, setRecording]);

  const stopRecording = useCallback(async () => {
    if (busyRef.current || !isRecordingRef.current) {
      return;
    }

    busyRef.current = true;
    try {
      stream.stop();
      setRecording(false);
      await releaseRecordingMode();

      const chunks = chunksRef.current;
      chunksRef.current = [];
      const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      if (total === 0 || sttState !== AiModelState.Ready || !stt.current) {
        return;
      }

      const samples = new Int16Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        samples.set(chunk, offset);
        offset += chunk.length;
      }

      setIsTranscribing(true);
      const text = (
        await stt.current.transcribePcm(samples, sampleRateRef.current).completed()
      ).trim();
      if (text) {
        onTranscribed(text);
      }
    } catch (error) {
      log('useSttTranscription stop', error);
    } finally {
      setIsTranscribing(false);
      busyRef.current = false;
    }
  }, [sttState, stt, stream, onTranscribed, releaseRecordingMode, setRecording]);

  const cancelRecording = useCallback(() => {
    if (!isRecordingRef.current) {
      return;
    }
    try {
      stream.stop();
    } catch (error) {
      log('useSttTranscription cancel', error);
    }
    chunksRef.current = [];
    setRecording(false);
    releaseRecordingMode();
  }, [stream, releaseRecordingMode, setRecording]);

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
