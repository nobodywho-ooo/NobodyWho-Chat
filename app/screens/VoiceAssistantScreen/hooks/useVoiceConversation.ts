import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioStream,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import {
  computeGenerationMetrics,
  log,
  stripThinkingBlocks,
  synthesizeChunked,
  wavToEnvelope,
} from 'helpers';
import { ToolInvocation } from 'types';
import { getAppState } from 'database';
import { insertConversation, insertMessage } from 'repositories';
import {
  AiModelState,
  notifyConversationSync,
  subscribeToolInvocations,
  useAiService,
} from 'services';

import { OrbLevelsController } from './useOrbLevels';

// Whisper works at 16 kHz; the engine resamples internally, so requesting the
// target rate up front just keeps captured buffers small. Mirrors
// useSttTranscription (the input-bar dictation path).
const TARGET_SAMPLE_RATE = 16000;

const PLAYBACK_FILE = 'voice-assistant-playback.wav';

// The phases of one hands-free turn, in the order they run.
export type VoiceStatus =
  | 'unavailable' // one of the three models isn't loaded — nothing to do
  | 'idle' // ready; waiting for the user to tap
  | 'listening' // microphone open, capturing the question
  | 'transcribing' // Whisper turning the capture into text
  | 'thinking' // the chat model generating an answer
  | 'speaking' // the answer playing back through TTS
  | 'error'; // last turn failed; tapping tries again

export interface VoiceAssistantStatus {
  isChatReady: boolean;
  isSttReady: boolean;
  isTtsReady: boolean;
}

export interface VoiceConversation {
  status: VoiceStatus;
  voiceAssistantStatus: VoiceAssistantStatus;
  isBusy: boolean;
  toggle: () => void;
}

interface UseVoiceConversationOptions {
  /** The orb drivers to feed from the mic and the answer playback. */
  orb: OrbLevelsController;
  /** Whether the screen is on-stage (drawer open); false stops everything. */
  active: boolean;
  /** Called when microphone permission is refused, so the screen can prompt. */
  onPermissionDenied?: () => void;
}

/**
 * Runs one hands-free turn end to end — capture the question on the microphone,
 * transcribe it with the loaded STT model, answer it with the loaded chat model,
 * and speak the answer with the loaded TTS model — driving the orb through each
 * phase. Reuses the shared chat instance (so the assistant keeps the current
 * conversation's context) and persists each completed turn to that conversation
 * — creating one if this is the first turn — so it also shows up in the chat
 * screen (see notifyConversationSync).
 */
export const useVoiceConversation = ({
  orb,
  active,
  onPermissionDenied,
}: UseVoiceConversationOptions): VoiceConversation => {
  const { t } = useTranslation();
  const { chat, stt, tts, chatState, sttState, ttsState, ttsArchitecture } =
    useAiService();

  const voiceAssistantStatus = useMemo<VoiceAssistantStatus>(
    () => ({
      isChatReady: chatState === AiModelState.Ready,
      isSttReady: sttState === AiModelState.Ready,
      isTtsReady: ttsState === AiModelState.Ready,
    }),
    [chatState, sttState, ttsState],
  );
  const isReady = voiceAssistantStatus.isChatReady && voiceAssistantStatus.isSttReady && voiceAssistantStatus.isTtsReady;

  const [status, setStatus] = useState<VoiceStatus>('idle');

  // Guards the async start/stop transitions against a double tap. The rest of
  // the turn is serialised by `status` (the button dispatches on it) and by the
  // turn token below.
  const busyRef = useRef(false);
  // Bumped whenever a turn is cancelled or superseded, so a late-resolving step
  // (transcription, generation, synthesis) discards its result instead of
  // driving a turn the user has already moved on from.
  const turnRef = useRef(0);
  // True only while this hook has an `ask` in flight on the shared chat. The
  // stop flag is per chat handle, so cancelling unconditionally would also kill
  // an answer the chat screen is streaming (the voice screen is reachable
  // mid-generation), and the native worker runs asks one at a time anyway.
  const generatingRef = useRef(false);
  // True only while this hook put the shared audio session into record mode.
  // The session is process-wide, so releasing it unconditionally would cut the
  // input route out from under the input bar's dictation, which owns its own
  // capture stream and never learns the mode changed.
  const ownsRecordingModeRef = useRef(false);

  // Captured PCM windows and the rate the hardware actually delivered. Refs, not
  // state, so onBuffer appends without a re-render per buffer.
  const chunksRef = useRef<Int16Array[]>([]);
  const sampleRateRef = useRef(TARGET_SAMPLE_RATE);

  const onBuffer = useCallback(
    (buffer: { data: ArrayBuffer; sampleRate: number }) => {
      const chunk = Int16Array.from(new Int16Array(buffer.data));
      chunksRef.current.push(chunk);
      sampleRateRef.current = buffer.sampleRate;
      // Feed the same window to the orb so it swells with the user's voice.
      orb.feedPcm(chunk, buffer.sampleRate);
    },
    [orb],
  );

  const { stream } = useAudioStream({
    sampleRate: TARGET_SAMPLE_RATE,
    channels: 1,
    encoding: 'int16',
    onBuffer,
  });

  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);

  // Restore the shared audio session to playback-only so the answer can route to
  // the speaker. Keep playsInSilentMode set: on iOS the audio mode is replaced
  // wholesale (not merged), so dropping it here would revert the session to the
  // .ambient category and mute the answer whenever the ringer/mute switch is on.
  // Best-effort — a failure here must not surface.
  // Only released when this hook took it — see ownsRecordingModeRef.
  const releaseRecordingMode = useCallback(async () => {
    if (!ownsRecordingModeRef.current) {
      return;
    }
    ownsRecordingModeRef.current = false;
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch (error) {
      log('useVoiceConversation release mode', error);
    }
  }, []);

  // Assemble captured PCM into one contiguous buffer
  const drainCapture = useCallback((): {
    samples: Int16Array;
    sampleRate: number;
  } => {
    const chunks = chunksRef.current;
    chunksRef.current = [];
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const samples = new Int16Array(total);
    let offset = 0;

    for (const chunk of chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }

    return { samples, sampleRate: sampleRateRef.current };
  }, []);

  // --- Persist a completed turn to the shared conversation -------------------
  // Writes the question and the answer to the conversation currently in use,
  // creating one (titled after the question) if the voice turn is the first
  // message. `content` keeps the raw generation (thinking blocks included) so a
  // persisted voice turn matches a typed one on reload; `notifyConversationSync`
  // then lets the chat root display it (and adopt a freshly created conversation).
  const persistTurn = useCallback(
    async (
      question: string,
      answerText: string,
      toolInvocations: ToolInvocation[],
      metrics: { tokensPerSecond?: number; timeToFirstToken?: number },
      stopped = false,
    ) => {
      try {
        const { conversationIdInUse, modelIdInUse } = getAppState();

        if (modelIdInUse === undefined) {
          return;
        }

        const conversationId =
          conversationIdInUse ??
          (await insertConversation({
            title: question,
            modelId: modelIdInUse,
          }));

        // The question is always written: `ask` has already appended it to the
        // shared chat's history, so skipping it here would leave the model
        // answering later messages from an exchange nothing can show.
        await insertMessage({
          conversationId,
          role: 'user',
          content: question,
          documentsPath: [],
        });

        if (answerText.trim()) {
          await insertMessage({
            conversationId,
            role: 'assistant',
            content: answerText,
            documentsPath: [],
            toolInvocations,
            ...metrics,
          });
        }

        if (stopped) {
          await insertMessage({
            conversationId,
            role: 'system',
            content: t('screens.chat.generationStopped'),
            documentsPath: [],
          });
        }

        notifyConversationSync(conversationId);
      } catch (error) {
        log('useVoiceConversation persist turn', error, { capture: true });
      }
    },
    [t],
  );

  // --- Transcribe → answer → synthesize → play -------------------------------
  const runTurn = useCallback(async () => {
    const turn = turnRef.current;
    const isCurrent = () => turn === turnRef.current;

    const { samples, sampleRate } = drainCapture();

    if (samples.length === 0) {
      setStatus('idle');
      return;
    }

    const sttInstance = stt.current;
    const chatInstance = chat.current;
    const ttsInstance = tts.current;

    if (!sttInstance || !chatInstance || !ttsInstance) {
      setStatus('idle');
      return;
    }

    // 1. Transcribe the captured question.
    setStatus('transcribing');
    let question: string;

    try {
      question = (
        await sttInstance.transcribePcm(samples, sampleRate).completed()
      ).trim();
    } catch (error) {
      log('useVoiceConversation transcribe', error, { capture: true });
      setStatus(isCurrent() ? 'error' : 'idle');
      return;
    }

    // Transcription can't be cancelled, so a turn abandoned while it ran leaves
    // its phase on screen until it lands here. Settle back to idle now.
    if (!isCurrent()) {
      setStatus('idle');
      return;
    }

    if (!question) {
      setStatus('idle');
      return;
    }

    // 2. Answer it with the shared chat model, streaming to accumulate. Capture
    // any tool calls the model makes along the way, so the persisted turn
    // reconstructs like a typed one (toModelHistory expands them on reload).
    setStatus('thinking');

    let answer = '';

    const startedAt = Date.now();
    let firstTokenAt: number | undefined;
    let tokenCount = 0;

    const toolInvocations: ToolInvocation[] = [];
    const unsubscribeTools = subscribeToolInvocations(invocation =>
      toolInvocations.push(invocation),
    );

    let failed = false;

    // From here the question is in the shared chat's history, and so is whatever
    // the model produces — the native worker appends the assistant turn even
    // when generation is stopped early, with no rollback.
    generatingRef.current = true;

    try {
      for await (const token of chatInstance.ask(question)) {
        if (!isCurrent()) {
          break;
        }

        if (firstTokenAt === undefined) {
          firstTokenAt = Date.now();
        }

        tokenCount += 1;
        answer += token;
      }
    } catch (error) {
      log('useVoiceConversation generate', error, { capture: true });
      failed = true;
    } finally {
      generatingRef.current = false;
      unsubscribeTools();
    }

    const metrics = computeGenerationMetrics(startedAt, firstTokenAt, tokenCount);

    // A stopped or failed turn still has to reach the database, or the model
    // would keep answering later messages from an exchange neither the chat
    // screen nor the history on reload contains. Mirrors the typed path, which
    // persists the partial answer plus a "generation stopped" note.
    if (failed || !isCurrent()) {
      await persistTurn(question, answer, toolInvocations, metrics, true);
      setStatus(failed && isCurrent() ? 'error' : 'idle');
      return;
    }

    // Record the completed turn so it appears in the chat screen. Persisting
    // before playback keeps the transcript even if synthesis or play fails.
    await persistTurn(question, answer, toolInvocations, metrics);

    // Persisting awaits the database, so the user may have cancelled by now —
    // check before spending seconds synthesizing an answer nobody will hear.
    if (!isCurrent()) {
      setStatus('idle');
      return;
    }

    const spoken = stripThinkingBlocks(answer).trim();

    if (!spoken) {
      setStatus('idle');
      return;
    }

    // 3. Synthesize the answer to a WAV.
    let wav: Uint8Array;
    try {
      wav =
        ttsArchitecture === 'kokoro'
          ? await synthesizeChunked(ttsInstance, spoken)
          : await ttsInstance.synthesize(spoken);
    } catch (error) {
      log('useVoiceConversation synthesize', error, { capture: true });
      setStatus(isCurrent() ? 'error' : 'idle');
      return;
    }
    if (!isCurrent()) {
      setStatus('idle');
      return;
    }

    // 4. Play it, driving the orb from the answer's own loudness envelope.
    try {
      const file = new File(Paths.cache, PLAYBACK_FILE);
      file.write(wav);
      player.replace({ uri: file.uri });
      orb.speak(wavToEnvelope(wav));
      setStatus('speaking');
      player.play();
    } catch (error) {
      log('useVoiceConversation play', error, { capture: true });
      orb.rest();
      setStatus(isCurrent() ? 'error' : 'idle');
    }
  }, [chat, stt, tts, ttsArchitecture, drainCapture, orb, player, persistTurn]);

  // --- Button transitions ----------------------------------------------------
  const startListening = useCallback(async () => {
    if (busyRef.current || !isReady) {
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

      // iOS needs a record-capable category before the input node can start;
      // keep it audible in silent mode too.
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      ownsRecordingModeRef.current = true;
      await stream.start();

      turnRef.current += 1;
      orb.listen();

      setStatus('listening');
    } catch (error) {
      log('useVoiceConversation start', error);
      await releaseRecordingMode();
      orb.rest();
      
      setStatus('error');
    } finally {
      busyRef.current = false;
    }
  }, [isReady, onPermissionDenied, stream, orb, releaseRecordingMode]);

  const stopAndAnswer = useCallback(async () => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;

    try {
      try {
        stream.stop();
      } catch (error) {
        log('useVoiceConversation stop stream', error);
      }

      await releaseRecordingMode();
      orb.rest();
      await runTurn();
    } finally {
      busyRef.current = false;
    }
  }, [stream, releaseRecordingMode, orb, runTurn]);

  // Abandon whatever the current turn is doing and return to idle. Used for an
  // in-flight cancel (tap while transcribing/thinking) and for stopping playback.
  // Cancel this hook's own generation, if it has one. Never call this while the
  // chat screen owns the stream: the stop flag belongs to the chat handle, not
  // to a turn, so it would cut short an answer being typed out there.
  const stopOwnGeneration = useCallback(() => {
    if (!generatingRef.current) {
      return;
    }
    try {
      chat.current?.stopGeneration();
    } catch (error) {
      log('useVoiceConversation stop generation', error);
    }
  }, [chat]);

  const abort = useCallback(() => {
    turnRef.current += 1;
    stopOwnGeneration();
    try {
      player.pause();
    } catch (error) {
      log('useVoiceConversation pause', error);
    }
    orb.rest();
    // Transcription can't be cancelled, so claiming idle here would offer a mic
    // that startListening refuses (the turn still holds busyRef). Leave the
    // phase on screen; runTurn settles it when the abandoned work lands.
    setStatus(current => (current === 'transcribing' ? current : 'idle'));
  }, [stopOwnGeneration, player, orb]);

  const toggle = useCallback(() => {
    if (!isReady) {
      return;
    }
    
    switch (status) {
      case 'idle':
      case 'error':
        startListening();
        break;
      case 'listening':
        stopAndAnswer();
        break;
      case 'transcribing':
      case 'thinking':
      case 'speaking':
        abort();
        break;
      default:
        break;
    }
  }, [isReady, status, startListening, stopAndAnswer, abort]);

  // Playback finished on its own → settle the orb and return to idle.
  useEffect(() => {
    if (playerStatus.didJustFinish) {
      orb.rest();
      setStatus(current => (current === 'speaking' ? 'idle' : current));
    }
  }, [playerStatus.didJustFinish, orb]);

  // Stop everything when the screen leaves the stage or a required model is torn
  // down (model switch, backgrounding). Leaves the mic and player released and
  // the orb at rest, so reopening the screen starts clean.
  const stopAll = useCallback(() => {
    turnRef.current += 1;
    // Without this the model would keep generating to the end of the answer off
    // screen: dropping out of the token loop only closes the iterator, which
    // never reaches the native worker's stop flag.
    stopOwnGeneration();
    try {
      stream.stop();
    } catch {
      // not recording
    }
    try {
      player.pause();
    } catch {
      // nothing playing
    }
    chunksRef.current = [];
    releaseRecordingMode();
    orb.rest();
    setStatus(current => (current === 'transcribing' ? current : 'idle'));
  }, [stopOwnGeneration, stream, player, releaseRecordingMode, orb]);

  useEffect(() => {
    if (!active || !isReady) {
      stopAll();
    }
  }, [active, isReady, stopAll]);

  useEffect(() => {
    return () => stopAll();
  }, [stopAll]);

  const isBusy =
    status === 'transcribing' ||
    status === 'thinking' ||
    status === 'speaking';

  return {
    status: isReady ? status : 'unavailable',
    voiceAssistantStatus,
    isBusy,
    toggle,
  };
};
