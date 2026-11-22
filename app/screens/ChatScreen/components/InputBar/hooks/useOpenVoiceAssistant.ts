import { useCallback, useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';
import { useDrawerCoordination } from 'navigation';

const KEYBOARD_HIDE_TIMEOUT = 400;

// Opens the voice assistant drawer, waiting for the keyboard to go away first
// (or giving up on it after a timeout) so the two don't animate over each other.
export const useOpenVoiceAssistant = () => {
  const { open: openDrawer } = useDrawerCoordination();

  // Undoes the wait below (drops the listener and the timeout) — set only while
  // an open is pending on the keyboard, so it doubles as "is one pending".
  const cancelPendingOpen = useRef<(() => void) | undefined>(undefined);

  useEffect(() => () => cancelPendingOpen.current?.(), []);

  return useCallback(() => {
    if (!Keyboard.isVisible()) {
      openDrawer('right');
      return;
    }

    cancelPendingOpen.current?.();

    const open = () => {
      cancelPendingOpen.current?.();
      openDrawer('right');
    };

    const subscription = Keyboard.addListener('keyboardDidHide', open);
    const timeout = setTimeout(open, KEYBOARD_HIDE_TIMEOUT);

    cancelPendingOpen.current = () => {
      cancelPendingOpen.current = undefined;
      subscription.remove();
      clearTimeout(timeout);
    };

    Keyboard.dismiss();
  }, [openDrawer]);
};
