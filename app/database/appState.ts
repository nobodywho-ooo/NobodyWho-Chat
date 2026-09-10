import { haptics, log } from 'helpers';
import { MODEL_SLOTS, ModelSlot, modelSlotSpec } from 'types';
import { getStorage } from './storage';

const APP_STATE = 'appState';

const CHAT_SLOT_KEY = modelSlotSpec(ModelSlot.chat).appStateKey;

export type AssistantConfig = {
  temperature: number;
  systemPrompt: string;
  thinking: boolean;
  toolCalling: boolean;
  contextSize: number;
  ttsVoice?: string;
  ttsLanguage?: string;
  sttLanguage?: string;
};

export const DEFAULT_ASSISTANT_CONFIG: AssistantConfig = {
  temperature: 0.8,
  systemPrompt: 'You are a helpful assistant running on a smartphone.',
  thinking: true,
  toolCalling: false,
  contextSize: 8000,
};

export type AppState = {
  modelIdInUse?: number;
  ttsModelIdInUse?: number;
  sttModelIdInUse?: number;
  vadModelIdInUse?: number;
  conversationIdInUse?: number;
  assistantConfig?: AssistantConfig;
};

function sameAssistantConfig(
  a: AssistantConfig | undefined,
  b: AssistantConfig | undefined,
): boolean {
  if (a === b) {
    return true;
  }
  if (a === undefined || b === undefined) {
    return false;
  }

  return (
    a.temperature === b.temperature &&
    a.systemPrompt === b.systemPrompt &&
    a.thinking === b.thinking &&
    a.toolCalling === b.toolCalling &&
    a.contextSize === b.contextSize &&
    a.ttsVoice === b.ttsVoice &&
    a.ttsLanguage === b.ttsLanguage &&
    a.sttLanguage === b.sttLanguage
  );
}

type AppStateListener = (next: AppState, prev: AppState) => void;

let _state: AppState = {};
const _listeners = new Set<AppStateListener>();

export async function hydrateAppState(): Promise<void> {
  const raw = await getStorage().getItem(APP_STATE);
  try {
    _state = raw !== undefined ? JSON.parse(raw) : {};
  } catch {
    _state = {};
  }
  // Fall back if fields added/renamed
  if (_state.assistantConfig) {
    _state.assistantConfig = {
      ...DEFAULT_ASSISTANT_CONFIG,
      ..._state.assistantConfig,
    };
  }
}

export function getAppState(): AppState {
  return _state;
}

export function subscribeAppState(listener: AppStateListener): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

export async function setAppState(patch: Partial<AppState>): Promise<void> {
  const prev = _state;
  const next = { ...prev, ...patch };
  if (
    MODEL_SLOTS.every(
      ({ appStateKey }) => next[appStateKey] === prev[appStateKey],
    ) &&
    next.conversationIdInUse === prev.conversationIdInUse &&
    sameAssistantConfig(next.assistantConfig, prev.assistantConfig)
  ) {
    return;
  }
  _state = next;
  await getStorage().setItem(APP_STATE, JSON.stringify(next));

  if (
    next[CHAT_SLOT_KEY] !== prev[CHAT_SLOT_KEY] &&
    next[CHAT_SLOT_KEY] !== undefined
  ) {
    haptics.medium();
  }

  // One throwing listener must not starve the others or reject setAppState.
  _listeners.forEach(listener => {
    try {
      listener(next, prev);
    } catch (error) {
      log('appState listener error', error, { capture: true });
    }
  });
}
