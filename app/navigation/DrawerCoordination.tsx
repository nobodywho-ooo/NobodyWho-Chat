import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  useState,
  FC,
  ReactNode,
} from 'react';
import {
  useDrawerStatus,
  type DrawerContentComponentProps,
  type DrawerNavigationOptions,
} from 'expo-router/drawer';
import type {
  LegacyPanGesture,
  NativeGesture,
} from 'react-native-gesture-handler';
import { haptics } from 'helpers';
import { drawerScrollGestureStore } from 'hooks';

type Side = 'left' | 'right';

interface CoordinationValue {
  openSide: Side | null;
  reportStatus: (side: Side, open: boolean) => void;
  registerOpener: (side: Side, open: (() => void) | null) => void;
  open: (side: Side) => void;
  // The mounted horizontal scroll gestures (MessageStarters, the models tabs),
  // so the drawer pans can require them to fail before activating (Android
  // scroll coordination).
  scrollGestures: NativeGesture[];
  // Height of the bottom strip the drawer swipes must keep their hands off, so
  // a drag inside the input bar never pulls a drawer in with it. Reported by
  // the input bar, which measures itself.
  swipeExclusion: number;
  reportSwipeExclusion: (height: number) => void;
}

const DrawerCoordinationContext = createContext<CoordinationValue>({
  openSide: null,
  reportStatus: () => undefined,
  registerOpener: () => undefined,
  open: () => undefined,
  scrollGestures: [],
  swipeExclusion: 0,
  reportSwipeExclusion: () => undefined,
});

export const useDrawerCoordination = () =>
  useContext(DrawerCoordinationContext);

export const DrawerCoordinationProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [openSide, setOpenSide] = useState<Side | null>(null);
  const openersRef = useRef<Partial<Record<Side, () => void>>>({});

  const reportStatus = useCallback((side: Side, open: boolean) => {
    setOpenSide(prev => {
      if (open) {
        return side;
      }
      // Only clear when the side that closed is the one we had recorded — a
      // stale "closed" from the other drawer must not wipe the open one.
      return prev === side ? null : prev;
    });
  }, []);

  const registerOpener = useCallback(
    (side: Side, open: (() => void) | null) => {
      if (open) {
        openersRef.current[side] = open;
      } else {
        delete openersRef.current[side];
      }
    },
    [],
  );

  const open = useCallback((side: Side) => {
    openersRef.current[side]?.();
  }, []);

  const [swipeExclusion, setSwipeExclusion] = useState(0);

  // Rounded and compared before storing: a layout pass reports subpixel heights
  // and fires on every keyboard move, and each change re-renders both drawers.
  const reportSwipeExclusion = useCallback((height: number) => {
    const rounded = Math.round(height);
    setSwipeExclusion(prev => (prev === rounded ? prev : rounded));
  }, []);

  const scrollGestures = useSyncExternalStore(
    drawerScrollGestureStore.subscribe,
    drawerScrollGestureStore.getSnapshot,
  );

  const value = useMemo(
    () => ({
      openSide,
      reportStatus,
      registerOpener,
      open,
      scrollGestures,
      swipeExclusion,
      reportSwipeExclusion,
    }),
    [
      openSide,
      reportStatus,
      registerOpener,
      open,
      scrollGestures,
      swipeExclusion,
      reportSwipeExclusion,
    ],
  );

  return (
    <DrawerCoordinationContext.Provider value={value}>
      {children}
    </DrawerCoordinationContext.Provider>
  );
};

// Rendered inside a drawer's content (so useDrawerStatus resolves that drawer's
// status) to publish its open/closed state up to the coordination context, and
// to buzz on every open and close — a swipe lands here the moment it commits,
// which is also what the drawer animates from.
//
// The navigator's own `transitionEnd` event can't drive this: the drawer emits
// it against the navigator's state key, while a screen's `listeners` only ever
// receive events targeted at their own route key, so nothing is delivered.
export const DrawerStatusReporter: FC<{
  side: Side;
  isSidebar?: boolean;
  navigation?: DrawerContentComponentProps['navigation'];
}> = ({ side, isSidebar = false, navigation }) => {
  const status = useDrawerStatus();
  const { reportStatus } = useDrawerCoordination();
  const isOpen = status === 'open' && !isSidebar;
  const previousIsOpen = useRef(isOpen);

  useEffect(() => {
    reportStatus(side, isOpen);
  }, [side, isOpen, reportStatus]);

  useEffect(() => {
    if (isSidebar && status === 'open') {
      navigation?.closeDrawer();
    }
  }, [isSidebar, status, navigation]);

  useEffect(() => {
    if (previousIsOpen.current === isOpen) {
      return;
    }

    previousIsOpen.current = isOpen;
    haptics.medium();
  }, [isOpen]);

  return null;
};

// Rendered inside a drawer's content (which receives that drawer's navigation)
// to register an imperative open handle with the coordination context. The
// latest navigation is read through a ref so the registered handle stays stable
// across the navigation object's re-renders.
export const DrawerOpenerReporter: FC<{
  side: Side;
  navigation: DrawerContentComponentProps['navigation'];
}> = ({ side, navigation }) => {
  const { registerOpener } = useDrawerCoordination();
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;

  useEffect(() => {
    registerOpener(side, () => navigationRef.current.openDrawer());
    return () => registerOpener(side, null);
  }, [side, registerOpener]);

  return null;
};

const OPEN_THRESHOLD = 10;
// A bound the drag can never reach, disabling activation in that direction.
const NEVER = 10000;

type HitSlop = Parameters<LegacyPanGesture['hitSlop']>[0];

// Both drawers open on a swipe started anywhere on screen (swipeEdgeWidth is the
// full window width), so a drag across the input bar — dragging a text selection
// to copy it, most visibly — used to pull a drawer halfway in before snapping
// back. Shrinking the pan's activation area from the bottom keeps it from ever
// receiving those touches: RNGH tests a negative hitSlop inset before it starts
// processing a touch stream, natively, so nothing peeks while JS catches up.
//
// Only while the drawer is closed. Once it's open the whole screen has to stay
// available for the drag that closes it again.
const excludeBottom = (hitSlop: HitSlop, exclusion: number): HitSlop => {
  if (exclusion <= 0) {
    return hitSlop;
  }

  // The drawer's own hitSlop is the `{ left | right, width }` form that scopes
  // the swipe to swipeEdgeWidth — kept, with the bottom inset added. The cast is
  // for RNGH's type, which models the edge and the width/height forms as
  // alternatives even though the native side reads each key on its own.
  return {
    ...(typeof hitSlop === 'object' && hitSlop !== null ? hitSlop : {}),
    bottom: -exclusion,
  } as HitSlop;
};

// Expo Router's drawer (react-native-drawer-layout 4) still builds its pan with
// RNGH's legacy builder API, while the scroll gestures come from RNGH 3
// ScrollViews. The legacy relations accept raw handler tags, which both APIs
// share. requireExternalGestureToFail's type leaves numbers out, hence `config`.
const configureDrawerPan = (
  gesture: LegacyPanGesture,
  activeOffsetX: [number, number],
  isOpen: boolean,
  scrollGestures: NativeGesture[],
  swipeExclusion: number,
) => {
  gesture.activeOffsetX(activeOffsetX);

  if (scrollGestures.length > 0) {
    gesture.config.requireToFail = [
      ...(gesture.config.requireToFail ?? []),
      ...scrollGestures.map(({ handlerTag }) => handlerTag),
    ];
  }

  if (!isOpen) {
    gesture.hitSlop(
      excludeBottom(gesture.config.hitSlop as HitSlop, swipeExclusion),
    );
  }

  return gesture;
};

// The navigator's type names RNGH 3's PanGesture, but what it hands over (and
// takes back) at runtime is the legacy builder.
type ConfigureGestureHandler = NonNullable<
  DrawerNavigationOptions['configureGestureHandler']
>;

const asConfigureGestureHandler = (
  configure: (gesture: LegacyPanGesture) => LegacyPanGesture,
) => configure as unknown as ConfigureGestureHandler;

// Left drawer: right-ward drag opens; when open, a left-ward drag closes it.
export const buildLeftDrawerGesture = (
  isOpen: boolean,
  scrollGestures: NativeGesture[],
  swipeExclusion: number,
) =>
  asConfigureGestureHandler(gesture =>
    configureDrawerPan(
      gesture,
      isOpen ? [-OPEN_THRESHOLD, OPEN_THRESHOLD] : [-NEVER, OPEN_THRESHOLD],
      isOpen,
      scrollGestures,
      swipeExclusion,
    ),
  );

// Right drawer: left-ward drag opens; when open, a right-ward drag closes it.
export const buildRightDrawerGesture = (
  isOpen: boolean,
  scrollGestures: NativeGesture[],
  swipeExclusion: number,
) =>
  asConfigureGestureHandler(gesture =>
    configureDrawerPan(
      gesture,
      isOpen ? [-OPEN_THRESHOLD, OPEN_THRESHOLD] : [-OPEN_THRESHOLD, NEVER],
      isOpen,
      scrollGestures,
      swipeExclusion,
    ),
  );
