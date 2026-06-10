import { getDatabase, closeDatabase, initDatabase } from './database';
import { getStorage } from './storage';
import {
  hydrateAppState,
  getAppState,
  setAppState,
  subscribeAppState,
} from './appState';

export type { AppState } from './appState';

export {
  getDatabase,
  closeDatabase,
  initDatabase,
  getStorage,
  hydrateAppState,
  getAppState,
  setAppState,
  subscribeAppState,
}
