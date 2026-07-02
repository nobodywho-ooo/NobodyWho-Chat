import { getDatabase, closeDatabase, initDatabase } from './database';
import { getStorage } from './storage';
import {
  hydrateAppState,
  getAppState,
  setAppState,
  subscribeAppState,
  DEFAULT_ASSISTANT_CONFIG,
} from './appState';

export type { AppState, AssistantConfig } from './appState';

export {
  getDatabase,
  closeDatabase,
  initDatabase,
  getStorage,
  hydrateAppState,
  getAppState,
  setAppState,
  subscribeAppState,
  DEFAULT_ASSISTANT_CONFIG,
}
