// A2UI button `Event` actions have no server to reach in an offline chat, so
// they are surfaced here and any listener (the chat screen) can react: show
// feedback and/or send a follow-up user turn back to the model so it can act.
// This is what makes an `action=Event("add_expense", {…})` button actually do
// something instead of only haptic-vibrating.

import { log } from 'helpers';

export interface A2UiEventSubscription {
  name: string;
  context?: Record<string, unknown>;
}

type A2UiEventListener = (event: A2UiEventSubscription) => void;

const listeners = new Set<A2UiEventListener>();

/** Fired by the renderer when a Button's `Event` action is pressed. */
export const emitA2UiEvent = (
  name: string,
  context?: Record<string, unknown>,
): void => {
  log('[a2ui] event', name, context);
  listeners.forEach(listener => {
    try {
      listener({ name, context });
    } catch (error) {
      log('A2UI event listener error', error);
    }
  });
};

/** Subscribe to Button events; returns an unsubscribe. */
export const subscribeA2UiEvents = (listener: A2UiEventListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};