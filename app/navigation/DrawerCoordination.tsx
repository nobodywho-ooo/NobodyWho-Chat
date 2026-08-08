import * as React from 'react';
import { useDrawerStatus } from '@react-navigation/drawer';
import type { PanGesture } from 'react-native-gesture-handler';

import { messageStartersScrollRef } from '../screens/ChatScreen/components/MessageStarters/MessageStarters';

type Side = 'left' | 'right';

interface CoordinationValue {
  openSide: Side | null;
  reportStatus: (side: Side, open: boolean) => void;
}

const DrawerCoordinationContext = React.createContext<CoordinationValue>({
  openSide: null,
  reportStatus: () => undefined,
});

export const useDrawerCoordination = () =>
  React.useContext(DrawerCoordinationContext);

export const DrawerCoordinationProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [openSide, setOpenSide] = React.useState<Side | null>(null);

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

  const value = React.useMemo(
    () => ({ openSide, reportStatus }),
    [openSide, reportStatus],
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

const OPEN_THRESHOLD = 10;
// A bound the drag can never reach, disabling activation in that direction.
const NEVER = 10000;

// Left drawer: right-ward drag opens; when open, a left-ward drag closes it.
export const buildLeftDrawerGesture =
  (isOpen: boolean) => (gesture: PanGesture) =>
    gesture
      .activeOffsetX(
        isOpen ? [-OPEN_THRESHOLD, OPEN_THRESHOLD] : [-NEVER, OPEN_THRESHOLD],
      )
      .requireExternalGestureToFail(messageStartersScrollRef);

// Right drawer: left-ward drag opens; when open, a right-ward drag closes it.
export const buildRightDrawerGesture =
  (isOpen: boolean) => (gesture: PanGesture) =>
    gesture
      .activeOffsetX(
        isOpen ? [-OPEN_THRESHOLD, OPEN_THRESHOLD] : [-OPEN_THRESHOLD, NEVER],
      )
      .requireExternalGestureToFail(messageStartersScrollRef);
