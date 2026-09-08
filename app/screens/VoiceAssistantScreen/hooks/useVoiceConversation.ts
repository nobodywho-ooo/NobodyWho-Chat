import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  requestRecordingPermissionsAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioStream,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import {
  acquireRecordingMode,
  cleanTranscript,
  computeGenerationMetrics,
  concatPcm,
  log,
  stripThinkingBlocks,
  synthesizeSpeech,
  wavToEnvelope,
} from 'helpers';
import { useSpeechService } from 'hooks';
import { ToolInvocation } from 'types';
import { getAppState } from 'database';
import { insertConversation, insertMessage } from 'repositories';
import {
  AiModelState,
  notifyConversationSync,
  subscribeToolInvocations,
  useAiService,
  VAD_SAMPLE_RATE,
} from 'services';

import { OrbLevelsController } from './useOrbLevels';

// Whisper works at 16 kHz; the engine resamples internally, so requesting the
// target rate up front just keeps captured buffers small. Mirrors
// useSttTranscription (the input-bar dictation path).
const TARGET_SAMPLE_RATE = 16000;

const PLAYBACK_FILE = 'voice-assistant-playback.wav';

// The phases of one hands-free turn, in the order they run.
export type VoiceStatus =
  | 'unavailable' // one of the four models isn't loaded — nothing to do
  | 'idle' // ready; waiting for the user to tap
  | 'listening' // microphone open, capturing the question
  | 'transcribing' // Whisper turning the capture into text
  | 'thinking' // the chat model generating an answer
  | 'synthesizing' // TTS turning the finished answer into audio
  | 'speaking' // the answer playing back through TTS
  | 'error'; // last turn failed; tapping tries again

export interface VoiceAssistantStatus {
  isChatReady: boolean;
  isSttReady: boolean;
  isTtsReady: boolean;
  /** Detects when the user stops talking, which is what ends a turn. */
  isVadReady: boolean;
}

export interface VoiceConversation {
  status: VoiceStatus;
  voiceAssistantStatus: VoiceAssistantStatus;
  isBusy: boolean;
  hasAnswered: boolean;
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
 * Runs one hands-free turn end to end — capture the question on the microphone
 * until the voice detection model hears the user stop talking, transcribe it
 * with the loaded STT model, answer it with the loaded chat model, and speak the
 * answer with the loaded TTS model — driving the orb through each phase. Reuses
 * the shared chat instance (so the assistant keeps the current conversation's
 * context) and persists each completed turn to that conversation — creating one
 * if this is the first turn — so it also shows up in the chat screen (see
 * notifyConversationSync).
 */
export const useVoiceConversation = ({
  orb,
  active,
  onPermissionDenied,
}: UseVoiceConversationOptions): VoiceConversation => {
  const { t } = useTranslation();
  const {
    chat,
    chatState,
    sttState,
    ttsState,
    ttsArchitecture,
    borrowStt,
    borrowTts,
  } = useAiService();

  // stopAll is defined below but has to be reachable from the preempt callback.
  // Kept in a ref so the speech service never has to be re-armed.
  const stopAllRef = useRef<() => void>(() => undefined);

  // The fourth model the screen needs: it is what notices the user has stopped
  // talking, which is how a turn ends here. Without it nothing would close the
  // microphone, so `isReady` below requires it like the other three. The
  // detector is shared with the input bar's dictation; if that takes it, this
  // turn can no longer end itself, so give the microphone up rather than listen
  // forever.
  const speechService = useSpeechService({
    onPreempted: () => stopAllRef.current(),
  });

  const voiceAssistantStatus = useMemo<VoiceAssistantStatus>(
    () => ({
      isChatReady: chatState === AiModelState.Ready,
      isSttReady: sttState === AiModelState.Ready,
      isTtsReady: ttsState === AiModelState.Ready,
      isVadReady: speechService.enabled,
    }),
    [chatState, sttState, ttsState, speechService.enabled],
  );
  const isReady =
    voiceAssistantStatus.isChatReady &&
    voiceAssistantStatus.isSttReady &&
    voiceAssistantStatus.isTtsReady &&
    voiceAssistantStatus.isVadReady;

  const [status, setStatus] = useState<VoiceStatus>('idle');
  // Set as soon as the model has produced any answer text — a stopped or failed
  // turn counts, since the shared chat's history keeps whatever it produced.
  const [hasAnswered, setHasAnswered] = useState(false);

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
  // This hook's hold on the process-wide record-mode session, when it has one.
  // Reference-counted in helpers/audioSession, so releasing here can't cut the
  // input route out from under the input bar's dictation.
  const releaseModeRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // `active` read from an async callback that started before the screen left
  // the stage. Assigned during render so it is never a render behind.
  const activeRef = useRef(active);
  activeRef.current = active;

  // Captured PCM windows and the rate the hardware actually delivered. Refs, not
  // state, so onBuffer appends without a re-render per buffer.
  const chunksRef = useRef<Int16Array[]>([]);
  const sampleRateRef = useRef(TARGET_SAMPLE_RATE);

  // True only between the mic opening and the turn being handed off, so a
  // buffer still in flight when the capture ends can't start a second turn.
  const listeningRef = useRef(false);
  // stopAndAnswer is defined below but has to be reachable from onBuffer, which
  // is what detects the end of speech. Kept in a ref so onBuffer doesn't have to
  // be redefined (and the auto-stop re-armed) on every render.
  const stopAndAnswerRef = useRef<() => void>(() => undefined);

  const onBuffer = useCallback(
    (buffer: { data: ArrayBuffer; sampleRate: number }) => {
      // slice() copies by memcpy; Int16Array.from would go through the
      // iterator protocol and box every sample first, ~10 times a second.
      const chunk = new Int16Array(buffer.data).slice();
      chunksRef.current.push(chunk);
      sampleRateRef.current = buffer.sampleRate;
      // Feed the same window to the orb so it swells with the user's voice.
      orb.feedPcm(chunk, buffer.sampleRate);

      // With a voice detection model loaded, the user falling silent ends the
      // question and answering starts straight away — no second tap. Every
      // buffer is fed to it — including the first few, which land before
      // `startListening` has flipped the flag — so the speech it keeps matches
      // what was recorded; only acting on the result is gated.
      const speechEnded = speechService.push(chunk, buffer.sampleRate);

      if (speechEnded && listeningRef.current) {
        listeningRef.current = false;
        stopAndAnswerRef.current();
      }
    },
    [orb, speechService],
  );

  const { stream } = useAudioStream({
    sampleRate: TARGET_SAMPLE_RATE,
    channels: 1,
    encoding: 'int16',
    onBuffer,
  });

  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);

  // Give up this hook's hold on record mode, so the answer can route back to
  // the speaker once no one else is still capturing.
  const releaseRecordingMode = useCallback(async () => {
    const release = releaseModeRef.current;
    releaseModeRef.current = undefined;
    await release?.();
  }, []);

  // Assemble the captured question, preferring the speech the detection model
  // kept — the same words with the silence around them trimmed off, at that
  // model's own fixed rate — so Whisper transcribes less audio and doesn't
  // hallucinate words into the quiet. Falls back to the unedited recording when
  // the model never settled on any speech: the user tapped stop early, or spoke
  // too briefly or too quietly to register.
  const drainCapture = useCallback((): {
    samples: Int16Array;
    sampleRate: number;
  } => {
    const chunks = chunksRef.current;
    chunksRef.current = [];

    const speech = speechService.takeSpeechToTranscribe();

    if (speech) {
      return { samples: speech, sampleRate: VAD_SAMPLE_RATE };
    }

    return { samples: concatPcm(chunks), sampleRate: sampleRateRef.current };
  }, [speechService]);

  // --- Persist a completed turn to the shared conversation -------------------
  // Writes the question and the answer to the conversation currently in use,
  // creating one (titled after the question) if the voice turn is the first
  // message. `content` keeps the raw generation (thinking blocks included) so a
  // persisted voice turn matches a typed one on reload; `notifyConversationSync`
  // then lets the chat root display it (and adopt a freshly created conversation).
  const persistTurn = useCallback(
    async (
      // Captured when the turn started, not read back from app state here: a
      // model switch mid-generation rewrites those ids, and re-reading them
      // would file this exchange under whichever model happened to be selected
      // by the time the database write ran.
      target: { conversationId?: number; modelId: number },
      question: string,
      answerText: string,
      toolInvocations: ToolInvocation[],
      metrics: { tokensPerSecond?: number; timeToFirstToken?: number },
      stopped = false,
    ) => {
      try {
        const conversationId =
          target.conversationId ??
          (await insertConversation({
            title: question,
            modelId: target.modelId,
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

    const chatInstance = chat.current;

    if (!chatInstance) {
      setStatus('idle');
      return;
    }

    // Where this turn will be filed. Read once, up front, so the whole turn is
    // attributed to the model that actually answers it (see persistTurn).
    const { conversationIdInUse, modelIdInUse } = getAppState();

    if (modelIdInUse === undefined) {
      setStatus('idle');
      return;
    }

    const target = {
      conversationId: conversationIdInUse,
      modelId: modelIdInUse,
    };

    // 1. Transcribe the captured question. Borrowed rather than read off the
    // ref: transcription can't be cancelled, so a dispose racing it has to wait
    // for it rather than free the engine mid-call.
    setStatus('transcribing');
    let question: string;

    try {
      const transcript = await borrowStt(instance =>
        instance.transcribePcm(samples, sampleRate).completed(),
      );

      if (transcript === undefined) {
        setStatus('idle');
        return;
      }

      question = cleanTranscript(transcript);
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

    const metrics = computeGenerationMetrics(
      startedAt,
      firstTokenAt,
      tokenCount,
    );

    if (answer.trim()) {
      setHasAnswered(true);
    }

    // A stopped or failed turn still has to reach the database, or the model
    // would keep answering later messages from an exchange neither the chat
    // screen nor the history on reload contains. Mirrors the typed path, which
    // persists the partial answer plus a "generation stopped" note.
    if (failed || !isCurrent()) {
      await persistTurn(
        target,
        question,
        answer,
        toolInvocations,
        metrics,
        true,
      );
      setStatus(failed && isCurrent() ? 'error' : 'idle');
      return;
    }

    // Record the completed turn so it appears in the chat screen. Persisting
    // before playback keeps the transcript even if synthesis or play fails.
    await persistTurn(target, question, answer, toolInvocations, metrics);

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

    // 3. Synthesize the answer to a WAV. Whether the engine needs its text
    // chunked client-side is a property of the engine, resolved inside
    // synthesizeSpeech so this path and the read-aloud button can't disagree.
    // Long answers take seconds here, so this gets its own phase rather than
    // leaving "thinking" on screen after the model has finished thinking.
    setStatus('synthesizing');

    let wav: Uint8Array | undefined;
    try {
      wav = await borrowTts(engine =>
        synthesizeSpeech(engine, ttsArchitecture, spoken),
      );
    } catch (error) {
      log('useVoiceConversation synthesize', error, { capture: true });
      setStatus(isCurrent() ? 'error' : 'idle');
      return;
    }
    if (wav === undefined || !isCurrent()) {
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
  }, [
    chat,
    borrowStt,
    borrowTts,
    ttsArchitecture,
    drainCapture,
    orb,
    player,
    persistTurn,
  ]);

  // --- Button transitions ----------------------------------------------------
  const startListening = useCallback(async () => {
    if (busyRef.current || !isReady) {
      return;
    }

    busyRef.current = true;

    // Bumped up front, so a stop landing while the awaits below are in flight
    // is visible here. Without it a cancel during the permission prompt is
    // ignored, the microphone opens behind the closed screen, and no effect is
    // left to close it — the turn then runs to completion off-stage.
    const turn = ++turnRef.current;
    const abandoned = () => turn !== turnRef.current || !activeRef.current;

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

      orb.listen();
      listeningRef.current = true;

      setStatus('listening');
    } catch (error) {
      log('useVoiceConversation start', error);
      await releaseRecordingMode();
      orb.rest();

      setStatus('error');
    } finally {
      busyRef.current = false;
    }
  }, [
    isReady,
    onPermissionDenied,
    stream,
    orb,
    releaseRecordingMode,
    speechService,
  ]);

  const stopAndAnswer = useCallback(async () => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    listeningRef.current = false;

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

  // Republish the latest stopAndAnswer for the auto-stop above. Assigning during
  // render (rather than in an effect) keeps it current even if a buffer arrives
  // before effects flush.
  stopAndAnswerRef.current = stopAndAnswer;

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

  // Abandon the current turn and return to idle. Only reachable by tapping stop
  // while the answer plays: the phases before that run to completion.
  const abort = useCallback(() => {
    turnRef.current += 1;
    listeningRef.current = false;
    speechService.reset();
    stopOwnGeneration();
    try {
      player.pause();
    } catch (error) {
      log('useVoiceConversation pause', error);
    }
    orb.rest();
    setStatus('idle');
  }, [stopOwnGeneration, player, orb, speechService]);

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
      // Transcribing, thinking and synthesizing are absent on purpose: they run
      // to completion, and the screen shows a spinner in place of the button
      // while they do. Only playback can be cut short.
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
    listeningRef.current = false;
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
    speechService.reset();
    speechService.release();
    releaseRecordingMode();
    orb.rest();
    setStatus(current => (current === 'transcribing' ? current : 'idle'));
    setHasAnswered(false);
  }, [
    stopOwnGeneration,
    stream,
    player,
    releaseRecordingMode,
    orb,
    speechService,
  ]);

  stopAllRef.current = stopAll;

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
    status === 'synthesizing' ||
    status === 'speaking';

  return {
    status: isReady ? status : 'unavailable',
    voiceAssistantStatus,
    isBusy,
    hasAnswered,
    toggle,
  };
};
