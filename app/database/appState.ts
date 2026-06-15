import { log } from 'helpers';
import { getStorage } from './storage';

const APP_STATE = 'appState';

export type AppState = {
  modelIdInUse?: number;
  conversationIdInUse?: number;
};

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
    next.conversationIdInUse === prev.conversationIdInUse
  ) {
    return;
  }
  _state = next;
  await getStorage().setItem(APP_STATE, JSON.stringify(next));
  // One throwing listener must not starve the others or reject setAppState.
  _listeners.forEach(listener => {
    try {
      listener(next, prev);
    } catch (error) {
      log('appState listener error', error, { capture: true});
    }
  });
}
