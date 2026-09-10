import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { VoiceActivityDetectionEvent } from 'react-native-nobodywho';

import { buildModel } from 'jest/factories/model';
import { MAX_RECORDING_MS, resetRecordingModeForTests } from 'helpers';
import { ModelPipeline } from 'types';
import { AiServiceProvider, useAiService } from 'services';

import { useSttTranscription } from '../../screens/ChatScreen/hooks/useSttTranscription';
import { useVoiceConversation } from '../../screens/VoiceAssistantScreen/hooks/useVoiceConversation';

// The two microphone features share one detector, and in the real tree both are
// mounted at once — the voice assistant is always the right drawer's content
// while the input bar sits in the chat screen. This suite drives the pair
// through the real hooks to check the handover between them, which no test of
// either hook alone can see.

(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;

// Each mounted capture hook registers its onBuffer here under a key naming its
// stream, so a test can play audio into one feature's microphone alone. Read
// only from inside the mock's hooks, which run long after this is initialised.
const mockEmitters: Record<string, (buffer: unknown) => void> = {};

// The shared expo-audio mock's stream never emits, so replace it with one that
// hands each consumer's onBuffer back to the test — one stream per hook, keyed
// in mount order, exactly as the two features capture independently.
jest.mock('expo-audio', () => {
  const mockReact = require('react');
  let streams = 0;

  return {
    useAudioStream: (options: { onBuffer?: (buffer: unknown) => void }) => {
      const ref = mockReact.useRef(null);

      if (!ref.current) {
        ref.current = {
          key: `stream${streams++}`,
          stream: {
            start: () => Promise.resolve(undefined),
            stop: () => undefined,
          },
        };
      }

      mockEmitters[ref.current.key] = buffer => options.onBuffer?.(buffer);

      return { stream: ref.current.stream, isStreaming: false };
    },
    requestRecordingPermissionsAsync: () =>
      Promise.resolve({ granted: true, canAskAgain: true }),
    setAudioModeAsync: () => Promise.resolve(undefined),
    // Stable across renders, like the real useReleasingSharedObject: a fresh
    // player each render would re-run the hook's teardown effect and stop the
    // turn it had just started.
    useAudioPlayer: () => {
      const ref = mockReact.useRef(null);

      if (!ref.current) {
        ref.current = {
          play: () => undefined,
          pause: () => undefined,
          replace: () => undefined,
        };
      }

      return ref.current;
    },
    useAudioPlayerStatus: () => ({ playing: false, didJustFinish: false }),
  };
});

const chatModel = buildModel(1, {
  parts: [
    {
      url: 'https://example.com/model.gguf',
      fileName: 'model.gguf',
      type: 'chat-model',
      path: '/models/1/model.gguf',
      sizeGB: 1,
    },
  ],
});

const ttsModel = buildModel(7, {
  pipeline: ModelPipeline.textToSpeech,
  family: 'Supertonic',
});

const sttModel = buildModel(11, {
  pipeline: ModelPipeline.speechToText,
  family: 'Whisper',
});

const vadModel = buildModel(12, {
  pipeline: ModelPipeline.voiceActivityDetection,
  family: 'Silero',
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AiServiceProvider>{children}</AiServiceProvider>
);

const orb = {
  levels: {} as never,
  feedPcm: jest.fn(),
  listen: jest.fn(),
  speak: jest.fn(),
  rest: jest.fn(),
};

const buffer = () => ({
  data: new Int16Array([1, 2, 3, 4]).buffer,
  sampleRate: 16000,
});

type MockVad = { mockEvents: number[]; push: jest.Mock; finish: jest.Mock };

// The detector's steady state while it hears nothing it is sure enough is
// speech. It reports the end of speech only when it confirmed the beginning, so
// a turn spent entirely here is one it can never end — which is what the
// recording cap is for.
const silentThroughout = (vad: MockVad) => {
  vad.push = jest.fn(() => VoiceActivityDetectionEvent.Silence);
};

const renderBothFeatures = async () => {
  resetRecordingModeForTests();
  for (const key of Object.keys(mockEmitters)) {
    delete mockEmitters[key];
  }

  const { result } = renderHook(
    () => ({
      // Mounted first, like the drawer content it is.
      voice: useVoiceConversation({ orb, active: true }),
      dictation: useSttTranscription({ onTranscribed: jest.fn() }),
      service: useAiService(),
    }),
    { wrapper },
  );

  await act(async () => {
    await result.current.service.createChat({ model: chatModel });
    await result.current.service.createStt({ model: sttModel });
    await result.current.service.createTts({ model: ttsModel });
    await result.current.service.createVad({ model: vadModel });
  });

  const vad = result.current.service.vad.current as unknown as MockVad;
  const [voiceStream, dictationStream] = Object.keys(mockEmitters);

  // Queue one utterance: the detector hears speech start, then end.
  const anUtterance = () => {
    vad.mockEvents = [
      VoiceActivityDetectionEvent.SpeechStarted,
      VoiceActivityDetectionEvent.SpeechEnded,
    ];
  };

  const speakInto = async (stream: string) => {
    await act(async () => {
      mockEmitters[stream](buffer());
      mockEmitters[stream](buffer());
    });
    await act(async () => undefined);
  };

  return { result, vad, anUtterance, speakInto, voiceStream, dictationStream };
};

test('a voice turn ends itself on the detector', async () => {
  const { result, anUtterance, speakInto, voiceStream } =
    await renderBothFeatures();

  anUtterance();
  await act(async () => {
    result.current.voice.toggle();
  });
  await act(async () => undefined);
  expect(result.current.voice.status).toBe('listening');

  await speakInto(voiceStream);

  expect(result.current.voice.status).not.toBe('listening');
});

test('dictation still starts right after a voice turn', async () => {
  const { result, vad, anUtterance, speakInto, voiceStream, dictationStream } =
    await renderBothFeatures();

  // A completed voice turn leaves the assistant holding the detector.
  anUtterance();
  await act(async () => {
    result.current.voice.toggle();
  });
  await act(async () => undefined);
  await speakInto(voiceStream);

  // Taking it back for dictation preempts the assistant, whose stop path
  // releases the detector as it goes. Handing it over before that happens had
  // the assistant give it straight back — leaving the dictation recording into
  // a detector that was no longer listening to it, so it could never end
  // itself, and cancelling the very start that took it.
  anUtterance();
  await act(async () => {
    await result.current.dictation.startRecording();
  });
  await act(async () => undefined);
  expect(result.current.dictation.isRecording).toBe(true);

  const before = vad.push.mock.calls.length;
  await speakInto(dictationStream);

  expect(vad.push.mock.calls.length).toBeGreaterThan(before);
  expect(result.current.dictation.isRecording).toBe(false);
});

test('either feature can take a second turn after the other has had one', async () => {
  const { result, anUtterance, speakInto, voiceStream, dictationStream } =
    await renderBothFeatures();

  const voiceTurn = async () => {
    anUtterance();
    await act(async () => {
      result.current.voice.toggle();
    });
    await act(async () => undefined);
    expect(result.current.voice.status).toBe('listening');
    await speakInto(voiceStream);
    expect(result.current.voice.status).not.toBe('listening');
  };

  const dictationTurn = async () => {
    anUtterance();
    await act(async () => {
      await result.current.dictation.startRecording();
    });
    await act(async () => undefined);
    expect(result.current.dictation.isRecording).toBe(true);
    await speakInto(dictationStream);
    expect(result.current.dictation.isRecording).toBe(false);
  };

  await dictationTurn();
  await voiceTurn();
  await dictationTurn();
  await voiceTurn();
});

// --- The recording cap ------------------------------------------------------

test('a voice turn the detector never hears speech in still closes the microphone', async () => {
  jest.useFakeTimers();

  try {
    const { result, vad, speakInto, voiceStream } = await renderBothFeatures();
    silentThroughout(vad);

    await act(async () => {
      result.current.voice.toggle();
    });
    await act(async () => undefined);
    expect(result.current.voice.status).toBe('listening');

    // Speaking gets nothing but silence back, so nothing ends the turn.
    await speakInto(voiceStream);
    expect(result.current.voice.status).toBe('listening');

    await act(async () => {
      jest.advanceTimersByTime(MAX_RECORDING_MS);
    });
    await act(async () => undefined);

    expect(result.current.voice.status).not.toBe('listening');
  } finally {
    jest.useRealTimers();
  }
});

test('a dictation the detector never hears speech in still closes the microphone', async () => {
  jest.useFakeTimers();

  try {
    const { result, vad, speakInto, dictationStream } =
      await renderBothFeatures();
    silentThroughout(vad);

    await act(async () => {
      await result.current.dictation.startRecording();
    });
    await act(async () => undefined);
    expect(result.current.dictation.isRecording).toBe(true);

    await speakInto(dictationStream);
    expect(result.current.dictation.isRecording).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(MAX_RECORDING_MS);
    });
    await act(async () => undefined);

    expect(result.current.dictation.isRecording).toBe(false);
  } finally {
    jest.useRealTimers();
  }
});

test('the cap is cleared by a turn that ends itself, not left to fire later', async () => {
  jest.useFakeTimers();

  try {
    const { result, vad, anUtterance, speakInto, dictationStream } =
      await renderBothFeatures();

    // Turn one ends on the detector, well inside the cap.
    anUtterance();
    await act(async () => {
      await result.current.dictation.startRecording();
    });
    await act(async () => undefined);
    await speakInto(dictationStream);
    expect(result.current.dictation.isRecording).toBe(false);

    // Half a cap later, a second turn opens the microphone again. Its own cap
    // now runs from here; the first turn's would still be counting from before.
    await act(async () => {
      jest.advanceTimersByTime(MAX_RECORDING_MS / 2);
    });

    silentThroughout(vad);
    await act(async () => {
      await result.current.dictation.startRecording();
    });
    await act(async () => undefined);
    expect(result.current.dictation.isRecording).toBe(true);

    // Past the point where the first turn's timer would have fired: an
    // uncleared one cuts this turn off mid-sentence.
    await act(async () => {
      jest.advanceTimersByTime(MAX_RECORDING_MS / 2 + 5000);
    });
    await act(async () => undefined);
    expect(result.current.dictation.isRecording).toBe(true);

    // Its own cap still ends it.
    await act(async () => {
      jest.advanceTimersByTime(MAX_RECORDING_MS);
    });
    await act(async () => undefined);
    expect(result.current.dictation.isRecording).toBe(false);
  } finally {
    jest.useRealTimers();
  }
});
