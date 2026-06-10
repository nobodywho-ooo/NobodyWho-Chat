import { Storage } from '@op-engineering/op-sqlite';

let _storage: Storage | null = null;

export function getStorage(): Storage {
  if (!_storage) {
    _storage = new Storage({});
  }
  return _storage;
}
