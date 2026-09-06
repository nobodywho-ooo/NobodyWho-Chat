import * as React from 'react';
import {
  useDrawerStatus,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import type {
  NativeGesture,
  PanGestureConfig,
} from 'react-native-gesture-handler';

import { scrollGestureStore } from '../screens/ChatScreen/components/MessageStarters/MessageStarters';

type Side = 'left' | 'right';

interface CoordinationValue {
  openSide: Side | null;
  reportStatus: (side: Side, open: boolean) => void;
  registerOpener: (side: Side, open: (() => void) | null) => void;
  open: (side: Side) => void;
  // The MessageStarters horizontal scroll gesture, when mounted, so the drawer
  // pan can require it to fail before activating (Android scroll coordination).
  scrollGesture: NativeGesture | null;
}

const DrawerCoordinationContext = React.createContext<CoordinationValue>({
  openSide: null,
  reportStatus: () => undefined,
  registerOpener: () => undefined,
  open: () => undefined,
  scrollGesture: null,
});

export const useDrawerCoordination = () =>
  React.useContext(DrawerCoordinationContext);

export const DrawerCoordinationProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [openSide, setOpenSide] = React.useState<Side | null>(null);
  const openersRef = React.useRef<Partial<Record<Side, () => void>>>({});

  const reportStatus = React.useCallback((side: Side, open: boolean) => {
    setOpenSide(prev => {
      if (open) {
        return side;
      }
      // Only clear when the side that closed is the one we had recorded — a
      // stale "closed" from the other drawer must not wipe the open one.
      return prev === side ? null : prev;
    });
  }, []);

  const registerOpener = React.useCallback(
    (side: Side, open: (() => void) | null) => {
      if (open) {
        openersRef.current[side] = open;
      } else {
        delete openersRef.current[side];
      }
    },
    [],
  );

  const open = React.useCallback((side: Side) => {
    openersRef.current[side]?.();
  }, []);

  const scrollGesture = React.useSyncExternalStore(
    scrollGestureStore.subscribe,
    scrollGestureStore.getSnapshot,
  );

  const value = React.useMemo(
    () => ({ openSide, reportStatus, registerOpener, open, scrollGesture }),
    [openSide, reportStatus, registerOpener, open, scrollGesture],
  );

  return (
    <DrawerCoordinationContext.Provider value={value}>
      {children}
    </DrawerCoordinationContext.Provider>
  );
};

// Rendered inside a drawer's content (so useDrawerStatus resolves that drawer's
// status) to publish its open/closed state up to the coordination context.
export const DrawerStatusReporter: React.FC<{ side: Side }> = ({ side }) => {
  const status = useDrawerStatus();
  const { reportStatus } = useDrawerCoordination();

  React.useEffect(() => {
    reportStatus(side, status === 'open');
  }, [side, status, reportStatus]);

  return null;
};

// Rendered inside a drawer's content (which receives that drawer's navigation)
// to register an imperative open handle with the coordination context. The
// latest navigation is read through a ref so the registered handle stays stable
// across the navigation object's re-renders.
export const DrawerOpenerReporter: React.FC<{
  side: Side;
  navigation: DrawerContentComponentProps['navigation'];
}> = ({ side, navigation }) => {
  const { registerOpener } = useDrawerCoordination();
  const navigationRef = React.useRef(navigation);
  navigationRef.current = navigation;

  React.useEffect(() => {
    registerOpener(side, () => navigationRef.current.openDrawer());
    return () => registerOpener(side, null);
  }, [side, registerOpener]);

  return null;
};

const OPEN_THRESHOLD = 10;
// A bound the drag can never reach, disabling activation in that direction.
const NEVER = 10000;

// Left drawer: right-ward drag opens; when open, a left-ward drag closes it.
export const buildLeftDrawerGesture =
  (isOpen: boolean, scrollGesture: NativeGesture | null) =>
  (gesture: PanGestureConfig): PanGestureConfig => ({
    ...gesture,
    activeOffsetX: isOpen
      ? [-OPEN_THRESHOLD, OPEN_THRESHOLD]
      : [-NEVER, OPEN_THRESHOLD],
    requireToFail: scrollGesture ?? undefined,
  });

// Right drawer: left-ward drag opens; when open, a right-ward drag closes it.
export const buildRightDrawerGesture =
  (isOpen: boolean, scrollGesture: NativeGesture | null) =>
  (gesture: PanGestureConfig): PanGestureConfig => ({
    ...gesture,
    activeOffsetX: isOpen
      ? [-OPEN_THRESHOLD, OPEN_THRESHOLD]
      : [-OPEN_THRESHOLD, NEVER],
    requireToFail: scrollGesture ?? undefined,
  });
