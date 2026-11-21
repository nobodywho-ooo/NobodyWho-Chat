import { log } from 'helpers';

// Pub-sub mirroring services/conversationSync.ts: subscribe returns its
// unsubscribe, and notify isolates listener errors so one failing listener
// can't break the caller.
//
// Fired when a finished download takes the empty chat slot — the user had no
// chat model to talk to and now has one (selectModel already cleared the
// conversation, so the chat opens on a new one). The drawer listens to switch
// to the chat (see DrawerNavigator). Onboarding downloads fire it too, but the
// drawer isn't mounted then, so nothing navigates.
export type ChatModelArrivalListener = () => void;

const listeners = new Set<ChatModelArrivalListener>();

export const subscribeChatModelArrival = (
  listener: ChatModelArrivalListener,
): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const notifyChatModelArrival = (): void => {
  listeners.forEach(listener => {
    try {
      listener();
    } catch (error) {
      log('chat model arrival listener error', error, { capture: true });
    }
  });
};
