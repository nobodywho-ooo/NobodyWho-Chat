import { useCallback, useEffect, useId } from 'react';
import type { NativeGesture } from 'react-native-gesture-handler';

// Every horizontal RNGH ScrollView on a drawer screen publishes its scroll
// gesture here, and the drawer pans `requireToFail` all of them (RNGH 3
// relations take gestures, not refs). Without it, Android's drawer pan
// activates first and the row can't scroll. Several can be mounted at once,
// since drawer screens stay mounted (e.g. MessageStarters + the models tabs).
const gestures = new Map<string, NativeGesture>();
let snapshot: NativeGesture[] = [];
const listeners = new Set<() => void>();

export const drawerScrollGestureStore = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => snapshot,
  set: (key: string, gesture: NativeGesture | null) => {
    if (gesture ? gestures.get(key) === gesture : !gestures.has(key)) {
      return;
    }
    if (gesture) {
      gestures.set(key, gesture);
    } else {
      gestures.delete(key);
    }
    snapshot = [...gestures.values()];
    listeners.forEach(listener => listener());
  },
};

// Returns the callback for a ScrollView's
// `onGestureUpdate_CAN_CAUSE_INFINITE_RERENDER` prop. The captured gesture's
// handler dies with the ScrollView, so it is dropped on unmount to stop the
// drawer pans waiting on a stale handler.
export const useDrawerScrollGesture = () => {
  const key = useId();

  useEffect(() => () => drawerScrollGestureStore.set(key, null), [key]);

  return useCallback(
    (gesture: NativeGesture) => drawerScrollGestureStore.set(key, gesture),
    [key],
  );
};
