import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  Chat,
  SpeechToText,
  TextToSpeech,
  VoiceActivityDetection,
} from 'react-native-nobodywho';
import * as Sentry from '@sentry/react-native';
import { ModelSlot } from 'types';

import {
  CHAT_ENGINE,
  ChatOptions,
  STT_ENGINE,
  SttOptions,
  TTS_ENGINE,
  TtsOptions,
  VAD_ENGINE,
  VadOptions,
} from './engines';
import { useNativeBackend } from './nativeBackend';
import { NativeSlot, useNativeSlot } from './nativeSlot';
import { AiServiceState, INITIAL_STATE } from './state';

export type AiSlots = {
  [ModelSlot.chat]: NativeSlot<Chat, ChatOptions>;
  [ModelSlot.tts]: NativeSlot<TextToSpeech, TtsOptions>;
  [ModelSlot.stt]: NativeSlot<SpeechToText, SttOptions>;
  [ModelSlot.vad]: NativeSlot<VoiceActivityDetection, VadOptions>;
};

export interface AiServiceContextValue extends AiServiceState {
  slots: AiSlots;
  disposeAll: () => void;
}

const AiServiceContext = createContext<AiServiceContextValue | undefined>(
  undefined,
);

export const AiServiceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AiServiceState>(INITIAL_STATE);
  const backend = useNativeBackend();

  const chat = useNativeSlot(CHAT_ENGINE, setState, backend);
  const tts = useNativeSlot(TTS_ENGINE, setState, backend);
  const stt = useNativeSlot(STT_ENGINE, setState, backend);
  const vad = useNativeSlot(VAD_ENGINE, setState, backend);

  const slots = useMemo<AiSlots>(
    () => ({ chat, tts, stt, vad }),
    [chat, tts, stt, vad],
  );

  const disposeAll = useCallback(() => {
    Object.values(slots).forEach(slot => slot.dispose());
  }, [slots]);

  const value = useMemo<AiServiceContextValue>(
    () => ({ ...state, slots, disposeAll }),
    [state, slots, disposeAll],
  );

  return (
    <AiServiceContext.Provider value={value}>
      {children}
    </AiServiceContext.Provider>
  );
};

export const useAiService = (): AiServiceContextValue => {
  const ctx = useContext(AiServiceContext);

  if (!ctx) {
    Sentry.captureMessage('AiServiceContextValue not available');
    throw new Error('useAiService must be used within an AiServiceProvider');
  }

  return ctx;
};
