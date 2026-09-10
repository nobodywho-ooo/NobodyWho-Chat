import { renderHook, act } from '@testing-library/react-native';

import { insertMessage } from 'repositories';
import { resetRecordingModeForTests, synthesizeSpeech } from 'helpers';

import { useVoiceConversation } from '../hooks/useVoiceConversation';

// What the drawer closing has to reach: a turn in flight. Each engine is a
// controllable stand-in, so a test can park the turn in one phase, close the
// screen, and then let that phase land.
const mockChat = {
  ask: jest.fn(),
  stopGeneration: jest.fn(),
};
const mockChatRef: { current: typeof mockChat | undefined } = {
  current: mockChat,
};
const mockStt = { transcribePcm: jest.fn() };
const mockTts = { synthesize: jest.fn() };

jest.mock('services', () => ({
  useAiService: () => ({
    chat: mockChatRef,
    chatState: 'ready',
    sttState: 'ready',
    ttsState: 'ready',
    ttsArchitecture: undefined,
    // Borrowing is what keeps a dispose from freeing an engine mid-call; here
    // it just hands the call the stand-in.
    borrowStt: (call: (engine: typeof mockStt) => unknown) => call(mockStt),
    borrowTts: (call: (engine: typeof mockTts) => unknown) => call(mockTts),
  }),
  AiModelState: {
    NotLoaded: 'notLoaded',
    Loading: 'loading',
    Ready: 'ready',
    Error: 'error',
  },
  subscribeToolInvocations: jest.fn(() => jest.fn()),
  notifyConversationSync: jest.fn(),
  VAD_SAMPLE_RATE: 16000,
}));

// The detector reports whatever this suite needs: a captured question to
// transcribe, and no end-of-speech (the tests drive the stop themselves).
const mockSpeechService = {
  enabled: true,
  reset: jest.fn(),
  release: jest.fn(),
  push: jest.fn(() => false),
  takeSpeechToTranscribe: jest.fn(() => Int16Array.from([1, 2, 3])),
};

jest.mock('hooks', () => ({
  useSpeechService: () => mockSpeechService,
}));

jest.mock('repositories', () => ({
  insertConversation: jest.fn(async () => 42),
  insertMessage: jest.fn(async () => 1),
}));

jest.mock('database', () => ({
  getAppState: () => ({ modelIdInUse: 0, conversationIdInUse: 5 }),
  subscribeAppState: () => () => {},
}));

// Synthesis and the playback envelope are stubbed so a test can assert that the
// TTS engine was never asked to work, rather than feed it real WAV bytes.
// Whether an in-flight chunked synthesis stops when the caller moves on is
// covered in helpers/__tests__/ttsAudio.test.ts.
jest.mock('helpers', () => ({
  ...jest.requireActual('helpers'),
  synthesizeSpeech: jest.fn(async () => Uint8Array.from([1, 2, 3])),
  wavToEnvelope: jest.fn(() => new Float32Array(1)),
}));

const mockPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  replace: jest.fn(),
  playing: false,
};
const mockStream = {
  start: jest.fn(async () => {}),
  stop: jest.fn(),
};
// The audio session's switch back to playback is the last thing stopAndAnswer
// awaits before handing the turn over to runTurn, so holding it open is how a
// test lands the drawer closing in that gap.
let mockHoldReleaseMode = false;
let mockReleaseMode: (() => void) | undefined;

jest.mock('expo-audio', () => ({
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => ({ playing: false, didJustFinish: false }),
  useAudioStream: () => ({ stream: mockStream, isStreaming: false }),
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setAudioModeAsync: jest.fn(
    async ({ allowsRecording }: { allowsRecording: boolean }) => {
      if (allowsRecording || !mockHoldReleaseMode) {
        return;
      }
      await new Promise<void>(resolve => {
        mockReleaseMode = resolve;
      });
    },
  ),
}));

const mockSynthesizeSpeech = synthesizeSpeech as jest.Mock;
const mockInsertMessage = insertMessage as jest.Mock;

// Stable across renders, the way the screen's useOrbLevels controller is: the
// turn's callbacks close over it.
const level = { value: 0 };
const orb = {
  levels: { level, low: level, mid: level, high: level },
  feedPcm: jest.fn(),
  listen: jest.fn(),
  speak: jest.fn(),
  rest: jest.fn(),
};

// A generation the test can hold open, so the screen can close mid-answer.
const heldGeneration = () => {
  let release: () => void = () => undefined;
  const held = new Promise<void>(resolve => {
    release = resolve;
  });

  mockChat.ask.mockImplementation(() =>
    (async function* () {
      yield 'partial';
      await held;
      yield ' never heard';
    })(),
  );

  return () => release();
};

const renderConversation = () => {
  const view = renderHook(
    ({ active }: { active: boolean }) =>
      useVoiceConversation({ orb: orb as never, active }),
    { initialProps: { active: true } },
  );

  return {
    ...view,
    // The drawer closing: the screen stays mounted, `active` goes false.
    close: () => act(() => view.rerender({ active: false })),
  };
};

// Tap the mic, then tap it again to end the question — the turn then runs on
// its own from transcription to playback.
const startListening = async (result: { current: { toggle: () => void } }) => {
  await act(async () => result.current.toggle());
};
const stopTalking = async (result: { current: { toggle: () => void } }) => {
  await act(async () => result.current.toggle());
};

beforeEach(() => {
  resetRecordingModeForTests();
  mockHoldReleaseMode = false;
  mockReleaseMode = undefined;
  mockChatRef.current = mockChat;
  mockChat.ask.mockReset().mockImplementation(() =>
    (async function* () {
      yield 'an answer';
    })(),
  );
  mockChat.stopGeneration.mockReset();
  mockStt.transcribePcm
    .mockReset()
    .mockImplementation(() => ({ completed: async () => 'what is the time' }));
  mockSpeechService.reset.mockClear();
  mockSpeechService.release.mockClear();
  mockSpeechService.takeSpeechToTranscribe
    .mockReset()
    .mockReturnValue(Int16Array.from([1, 2, 3]));
  mockSynthesizeSpeech.mockClear();
  mockInsertMessage.mockClear();
  mockPlayer.play.mockClear();
  mockPlayer.pause.mockClear();
  mockStream.start.mockClear();
  mockStream.stop.mockClear();
  Object.values(orb).forEach(value => {
    if (jest.isMockFunction(value)) {
      value.mockClear();
    }
  });
});

test('a whole turn runs to playback while the screen stays open', async () => {
  const { result } = renderConversation();

  await startListening(result);
  expect(result.current.status).toBe('listening');

  await stopTalking(result);

  // The baseline the tests below are the absence of: transcribed, answered,
  // synthesized, spoken.
  expect(mockStt.transcribePcm).toHaveBeenCalled();
  expect(mockChat.ask).toHaveBeenCalledWith('what is the time');
  expect(mockSynthesizeSpeech).toHaveBeenCalled();
  expect(mockPlayer.play).toHaveBeenCalled();
  expect(result.current.status).toBe('speaking');
});

test('closing the screen mid-answer stops the generation and never speaks it', async () => {
  const finishGeneration = heldGeneration();
  const { result, close } = renderConversation();

  await startListening(result);
  await stopTalking(result);
  expect(result.current.status).toBe('thinking');

  close();

  // Dropping out of the token loop only closes the iterator; the native worker
  // keeps going to the end of the answer unless it is told to stop.
  expect(mockChat.stopGeneration).toHaveBeenCalled();

  await act(async () => {
    finishGeneration();
  });

  expect(mockSynthesizeSpeech).not.toHaveBeenCalled();
  expect(mockPlayer.play).not.toHaveBeenCalled();
  expect(result.current.status).toBe('idle');

  // The question and whatever the model produced are already in the shared
  // chat's history, so the abandoned turn is still written — with a "stopped"
  // note, like the typed path.
  const roles = mockInsertMessage.mock.calls.map(([m]) => m.role);
  expect(roles).toEqual(['user', 'assistant', 'system']);
});

test('closing the screen while transcribing never asks the model', async () => {
  // Transcription has no cancel, so the call in flight lands either way; what
  // must not happen is a turn continuing past it.
  let finishTranscription: (text: string) => void = () => undefined;
  mockStt.transcribePcm.mockImplementation(() => ({
    completed: () =>
      new Promise<string>(resolve => {
        finishTranscription = resolve;
      }),
  }));

  const { result, close } = renderConversation();

  await startListening(result);
  await stopTalking(result);
  expect(result.current.status).toBe('transcribing');

  close();

  await act(async () => {
    finishTranscription('what is the time');
  });

  expect(mockChat.ask).not.toHaveBeenCalled();
  expect(mockSynthesizeSpeech).not.toHaveBeenCalled();
  expect(result.current.status).toBe('idle');
});

test('a turn handed over after the screen closed starts no work at all', async () => {
  // stopAndAnswer waits for the audio session before running the turn; closing
  // the screen inside that wait leaves a turn about to start on a screen that
  // is already gone.
  mockHoldReleaseMode = true;

  const { result, close } = renderConversation();

  await startListening(result);

  // Tapping stop parks on the held session rather than handing over.
  await act(async () => {
    result.current.toggle();
  });
  expect(mockStt.transcribePcm).not.toHaveBeenCalled();

  close();

  await act(async () => {
    mockReleaseMode?.();
  });

  // The turn reached runTurn on a closed screen: nothing was transcribed, asked
  // or synthesized, and none of it can be called off once started.
  expect(mockStt.transcribePcm).not.toHaveBeenCalled();
  expect(mockChat.ask).not.toHaveBeenCalled();
  expect(mockSynthesizeSpeech).not.toHaveBeenCalled();
  expect(result.current.status).toBe('idle');
});

test('closing the screen mid-question releases the microphone', async () => {
  const { result, close } = renderConversation();

  await startListening(result);
  expect(result.current.status).toBe('listening');

  close();

  expect(mockStream.stop).toHaveBeenCalled();
  expect(mockSpeechService.release).toHaveBeenCalled();
  expect(orb.rest).toHaveBeenCalled();
  expect(result.current.status).toBe('idle');
});

test('closing the screen mid-playback stops the audio', async () => {
  const { result, close } = renderConversation();

  await startListening(result);
  await stopTalking(result);
  expect(result.current.status).toBe('speaking');

  close();

  expect(mockPlayer.pause).toHaveBeenCalled();
  expect(result.current.status).toBe('idle');
});
