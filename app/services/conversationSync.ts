import { log } from 'helpers';

// Pub-sub mirroring services/tools.ts and database/appState.ts: subscribe
// returns its unsubscribe, and notify isolates listener errors so one failing
// listener can't break the caller.
//
// The voice assistant (VoiceAssistantScreen) and the chat screen render from
// separate state but drive the *same* native Chat instance. When the voice
// assistant persists a turn (see useVoiceConversation) it notifies here with the
// conversation it wrote to, so the chat root (ChatStackNavigator) can reflect
// those messages — the shared chat already holds the turn's context, so only the
// displayed history needs syncing.
export type ConversationSyncListener = (conversationId: number) => void;

const listeners = new Set<ConversationSyncListener>();

export const subscribeConversationSync = (
  listener: ConversationSyncListener,
): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const notifyConversationSync = (conversationId: number): void => {
  listeners.forEach(listener => {
    try {
      listener(conversationId);
    } catch (error) {
      log('conversation sync listener error', error, { capture: true });
    }
  });
};
