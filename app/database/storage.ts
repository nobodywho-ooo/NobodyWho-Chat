import { Storage } from '@op-engineering/op-sqlite';

const MODEL_ID_IN_USE = 'modelIdInUse';
const CHAT_ID_IN_USE = 'chatIdInUse';

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


/* CHAT ID IN USE */

export async function getChatIdInUse(): Promise<number | undefined> {
  const value = await getStorage().getItem(CHAT_ID_IN_USE);
  return value !== undefined ? parseInt(value, 10) : undefined;
}

type ChatIdInUseListener = (id: number | undefined) => void;

const _chatIdInUseListeners = new Set<ChatIdInUseListener>();

export function subscribeChatIdInUse(
  listener: ChatIdInUseListener,
): () => void {
  _chatIdInUseListeners.add(listener);
  return () => {
    _chatIdInUseListeners.delete(listener);
  };
}

export async function setChatIdInUse(id: number): Promise<void> {
  const current = await getChatIdInUse();
  await getStorage().setItem(CHAT_ID_IN_USE, id.toString());
  // Only notify subscribers when the value actually changes.
  if (current !== id) {
    _chatIdInUseListeners.forEach(listener => listener(id));
  }
}
