import type { TextToSpeechArchitecture } from 'react-native-nobodywho';
import type { ImplicitThinkOpen } from 'helpers';
import { ChatPipeline, ModelPipeline, ModelSlot } from 'types';

export enum AiModelState {
  NotLoaded = 'notLoaded',
  Loading = 'loading',
  Ready = 'ready',
  Error = 'error',
}

/** Where a slot's load state lives in AiServiceState: `chat` → `chatState`. */
export type SlotStateKey = `${ModelSlot}State`;

// One load state per slot, plus whatever a loaded engine tells the app about
// itself that it can't read back off the instance.
export interface AiServiceState {
  chatState: AiModelState;
  ttsState: AiModelState;
  sttState: AiModelState;
  vadState: AiModelState;

  /** What the loaded chat model can ingest — text, images, audio. */
  chatPipeline: ChatPipeline;
  /** The reasoning delimiter its chat template prefills, if any. */
  chatThinkOpen?: ImplicitThinkOpen;
  /** Which TTS engine backs the loaded voice, for callers that chunk text. */
  ttsArchitecture?: TextToSpeechArchitecture;
}

export const INITIAL_STATE: AiServiceState = {
  chatState: AiModelState.NotLoaded,
  ttsState: AiModelState.NotLoaded,
  sttState: AiModelState.NotLoaded,
  vadState: AiModelState.NotLoaded,
  chatPipeline: ModelPipeline.textGeneration,
  chatThinkOpen: undefined,
  ttsArchitecture: undefined,
};
