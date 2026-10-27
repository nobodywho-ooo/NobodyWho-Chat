import { useSyncExternalStore } from 'react';
import { getStorage } from 'database';
import { log } from 'helpers';

import type { WebSearchProgressEvent } from './runWebSearch';

// UI state of the web search: which chats have it on, the live trace of the
// running search, and the bot-challenge hand-off between the hidden scrape
// WebView and the screen. Same shape as private-mind's zustand store (the
// ported scrape host and trace builder read it as-is), on a plain
// useSyncExternalStore since the app has no state library.

export type ChallengePolicy = 'ask' | 'reveal' | 'skip';

export const DEFAULT_CHALLENGE_POLICY: ChallengePolicy = 'ask';

const CHALLENGE_POLICIES: ChallengePolicy[] = ['ask', 'reveal', 'skip'];
const CHALLENGE_POLICY_KEY = 'webSearchChallengePolicy';

export interface WebSearchTraceEntry extends WebSearchProgressEvent {
  id: number;
}

export const WEB_TRACE_MAX = 64;
let nextTraceId = 0;

// The conversation a chat has before its first message creates one.
export const NEW_CHAT_KEY = -1;

const isPhaseEvent = (event: WebSearchProgressEvent): boolean =>
  event.type === 'reading' || event.type === 'ranking';

// Why a search didn't run or came back empty; the chat screen words it.
export type WebSearchNotice =
  | 'nothingFound'
  | 'noRoom'
  | 'unavailable'
  | 'modelTooSmall'
  | 'notEnoughMemory'
  | 'attachment';

export interface ChallengeHandlers {
  open: () => void;
  cancel: () => void;
}

interface WebSearchState {
  enabledByChat: Record<number, boolean>;
  isSearchingWeb: boolean;
  webSearchTrace: WebSearchTraceEntry[];
  traceExpanded: boolean;
  challengeActive: boolean;
  challengePolicy: ChallengePolicy;
  challengeHandlers: ChallengeHandlers | null;
  // A one-line message for the chat screen (search skipped, nothing found…).
  notice: { id: number; kind: WebSearchNotice } | null;
}

interface WebSearchActions {
  isEnabled: (chatId: number | undefined) => boolean;
  setEnabled: (chatId: number | undefined, enabled: boolean) => void;
  clearEnabled: (chatId: number | undefined) => void;
  transfer: (fromChatId: number, toChatId: number) => void;
  setSearchingWeb: (searching: boolean) => void;
  pushWebSearchEvent: (event: WebSearchProgressEvent) => void;
  resetTrace: () => void;
  setTraceExpanded: (expanded: boolean) => void;
  setChallengeActive: (active: boolean) => void;
  updateChallengePolicy: (policy: ChallengePolicy) => void;
  registerChallengeHandlers: (handlers: ChallengeHandlers | null) => void;
  openChallenge: () => void;
  cancelChallenge: () => void;
  showNotice: (kind: WebSearchNotice) => void;
  clearNotice: (id: number) => void;
}

export type WebSearchStore = WebSearchState & WebSearchActions;

const listeners = new Set<() => void>();
let nextNoticeId = 0;

const keyOf = (chatId: number | undefined): number => chatId ?? NEW_CHAT_KEY;

const readChallengePolicy = (): ChallengePolicy => {
  try {
    const saved = getStorage().getItemSync(CHALLENGE_POLICY_KEY);
    return CHALLENGE_POLICIES.includes(saved as ChallengePolicy)
      ? (saved as ChallengePolicy)
      : DEFAULT_CHALLENGE_POLICY;
  } catch (error) {
    log('webSearchStore read challenge policy failed', error);
    return DEFAULT_CHALLENGE_POLICY;
  }
};

let state: WebSearchStore;

const set = (
  next:
    | Partial<WebSearchState>
    | ((current: WebSearchStore) => Partial<WebSearchState>),
): void => {
  const patch = typeof next === 'function' ? next(state) : next;
  state = { ...state, ...patch };
  listeners.forEach(listener => listener());
};

const get = (): WebSearchStore => state;

state = {
  enabledByChat: {},
  isSearchingWeb: false,
  webSearchTrace: [],
  traceExpanded: false,
  challengeActive: false,
  // Read lazily on first access below, so importing this module never touches
  // the database (tests and the module graph load it before storage is set up).
  challengePolicy: DEFAULT_CHALLENGE_POLICY,
  challengeHandlers: null,
  notice: null,

  isEnabled: chatId => get().enabledByChat[keyOf(chatId)] ?? false,

  setEnabled: (chatId, enabled) =>
    set(current => ({
      enabledByChat: { ...current.enabledByChat, [keyOf(chatId)]: enabled },
    })),

  clearEnabled: chatId => {
    const key = keyOf(chatId);
    if (!(key in get().enabledByChat)) {
      return;
    }
    set(current => {
      const next = { ...current.enabledByChat };
      delete next[key];
      return { enabledByChat: next };
    });
  },

  transfer: (fromChatId, toChatId) => {
    const value = get().enabledByChat[fromChatId];
    if (value === undefined) {
      return;
    }
    set(current => {
      const next = { ...current.enabledByChat, [toChatId]: value };
      if (fromChatId !== toChatId) {
        delete next[fromChatId];
      }
      return { enabledByChat: next };
    });
  },

  setSearchingWeb: searching =>
    set(current => {
      const isNewSearch = searching && !current.isSearchingWeb;
      return {
        isSearchingWeb: searching,
        webSearchTrace: isNewSearch ? [] : current.webSearchTrace,
        traceExpanded: isNewSearch ? false : current.traceExpanded,
        challengeActive: isNewSearch ? false : current.challengeActive,
      };
    }),

  pushWebSearchEvent: event => {
    const entry: WebSearchTraceEntry = { ...event, id: nextTraceId++ };
    set(current => {
      const previous = current.webSearchTrace;
      const last = previous[previous.length - 1];
      const base =
        last && isPhaseEvent(last) && isPhaseEvent(entry)
          ? previous.slice(0, -1)
          : previous;
      const next = [...base, entry];
      return {
        webSearchTrace:
          next.length > WEB_TRACE_MAX ? next.slice(-WEB_TRACE_MAX) : next,
      };
    });
  },

  resetTrace: () =>
    set({ webSearchTrace: [], traceExpanded: false, challengeActive: false }),

  setTraceExpanded: expanded => set({ traceExpanded: expanded }),

  setChallengeActive: active => set({ challengeActive: active }),

  updateChallengePolicy: policy => {
    set({ challengePolicy: policy });
    try {
      getStorage().setItemSync(CHALLENGE_POLICY_KEY, policy);
    } catch (error) {
      log('webSearchStore save challenge policy failed', error);
    }
  },

  registerChallengeHandlers: handlers => set({ challengeHandlers: handlers }),

  openChallenge: () => get().challengeHandlers?.open(),

  cancelChallenge: () => {
    set({ challengeActive: false });
    get().challengeHandlers?.cancel();
  },

  showNotice: kind => set({ notice: { id: ++nextNoticeId, kind } }),

  clearNotice: id => {
    if (get().notice?.id === id) {
      set({ notice: null });
    }
  },
};

let policyLoaded = false;

const getState = (): WebSearchStore => {
  if (!policyLoaded) {
    policyLoaded = true;
    state = { ...state, challengePolicy: readChallengePolicy() };
  }
  return state;
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useWebSearchStore<T>(
  selector: (store: WebSearchStore) => T,
): T {
  return useSyncExternalStore(subscribe, () => selector(getState()));
}

useWebSearchStore.getState = getState;
useWebSearchStore.setState = set;
useWebSearchStore.subscribe = subscribe;
