import { haptics, log } from 'helpers';
import { getStorage } from './storage';

const APP_STATE = 'appState';

export type AssistantConfig = {
  temperature: number;
  systemPrompt: string;
  thinking: boolean;
  toolCalling: boolean;
  maxTokens: number;
};

export const DEFAULT_ASSISTANT_CONFIG: AssistantConfig = {
  temperature: 0.8,
  systemPrompt: '',
  thinking: true,
  toolCalling: false,
  maxTokens: 8000, // context size
};

export type AppState = {
  modelIdInUse?: number;
  ttsModelIdInUse?: number;
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
    a.maxTokens === b.maxTokens
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
    next.modelIdInUse === prev.modelIdInUse &&
    next.ttsModelIdInUse === prev.ttsModelIdInUse &&
    next.conversationIdInUse === prev.conversationIdInUse &&
    sameAssistantConfig(next.assistantConfig, prev.assistantConfig)
  ) {
    return;
  }
  _state = next;
  await getStorage().setItem(APP_STATE, JSON.stringify(next));
  // One throwing listener must not starve the others or reject setAppState.
  _listeners.forEach(listener => {
    try {
      listener(next, prev);
      haptics.medium();
    } catch (error) {
      log('appState listener error', error, { capture: true});
    }
  });
}
