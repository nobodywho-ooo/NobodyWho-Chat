import { Storage } from '@op-engineering/op-sqlite';

const MODEL_ID_IN_USE = 'modelIdInUse';

let _storage: Storage | null = null;

export function getStorage(): Storage {
  if (!_storage) {
    _storage = new Storage({});
  }
  return _storage;
}

export async function getModelIdInUse(): Promise<number | undefined> {
  const value = await getStorage().getItem(MODEL_ID_IN_USE);
  return value !== undefined ? parseInt(value, 10) : undefined;
}

export async function setModelIdInUse(id: number): Promise<void> {
  await getStorage().setItem(MODEL_ID_IN_USE, id.toString());
}
