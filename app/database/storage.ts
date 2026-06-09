import { Storage } from '@op-engineering/op-sqlite';

const MODEL_ID_IN_USE = 'modelIdInUse';
const CONVERSATION_ID_IN_USE = 'conversationIdInUse';

let _storage: Storage | null = null;

export function getStorage(): Storage {
  if (!_storage) {
    _storage = new Storage({});
  }
  return _storage;
}

/* MODEL ID IN USE */

export async function getModelIdInUse(): Promise<number | undefined> {
  const value = await getStorage().getItem(MODEL_ID_IN_USE);
  return value !== undefined ? parseInt(value, 10) : undefined;
}

type ModelIdInUseListener = (id: number | undefined) => void;

const _modelIdInUseListeners = new Set<ModelIdInUseListener>();

export function subscribeModelIdInUse(
  listener: ModelIdInUseListener,
): () => void {
  _modelIdInUseListeners.add(listener);
  return () => {
    _modelIdInUseListeners.delete(listener);
  };
}

export async function setModelIdInUse(id: number): Promise<void> {
  const current = await getModelIdInUse();
  await getStorage().setItem(MODEL_ID_IN_USE, id.toString());
  // Only notify subscribers when the value actually changes.
  if (current !== id) {
    _modelIdInUseListeners.forEach(listener => listener(id));
  }
}


/* CONVERSATION ID IN USE */

export async function getConversationIdInUse(): Promise<number | undefined> {
  const value = await getStorage().getItem(CONVERSATION_ID_IN_USE);
  return value !== undefined ? parseInt(value, 10) : undefined;
}

type ConversationIdInUseListener = (id: number | undefined) => void;

const _conversationIdInUseListeners = new Set<ConversationIdInUseListener>();

export function subscribeConversationIdInUse(
  listener: ConversationIdInUseListener,
): () => void {
  _conversationIdInUseListeners.add(listener);
  return () => {
    _conversationIdInUseListeners.delete(listener);
  };
}

export async function setConversationIdInUse(id: number): Promise<void> {
  const current = await getConversationIdInUse();
  await getStorage().setItem(CONVERSATION_ID_IN_USE, id.toString());
  // Only notify subscribers when the value actually changes.
  if (current !== id) {
    _conversationIdInUseListeners.forEach(listener => listener(id));
  }
}
