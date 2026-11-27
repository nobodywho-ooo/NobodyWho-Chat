import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DRAWER_MAX_WIDTH,
  PHONE_MAX_WIDTH,
  SIDEBAR_WIDTH,
  VOICE_DRAWER_MAX_WIDTH,
  WIDE_LAYOUT_MIN_WIDTH,
} from 'style';

type Side = 'left' | 'right';

const overlayWidth = (side: Side, windowWidth: number) => {
  if (side === 'right') {
    return Math.min(windowWidth, VOICE_DRAWER_MAX_WIDTH);
  }
  return windowWidth <= PHONE_MAX_WIDTH ? windowWidth : DRAWER_MAX_WIDTH;
};

// Drawer geometry, read from the live window so it follows a foldable opening
// or closing, iPad multitasking and rotation mid-session.
//
// - left (menu): an overlay covering the whole window on phones, capped on
//   larger windows, and a permanent sidebar on wide ones (`isSidebar`).
// - right (voice assistant): full width on phones, capped on wide windows.
//
// paddingLeft/paddingRight are the safe-area insets of the screen edges the
// drawer touches — on iPhone Duo the status bar is an 84-pt vertical rail on
// the left or right edge in landscape. Apply them to the drawer, or to its
// content when something must still bleed to the edge.
export const useDrawerFrame = (side: Side) => {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isSidebar = side === 'left' && windowWidth >= WIDE_LAYOUT_MIN_WIDTH;
  const width = isSidebar ? SIDEBAR_WIDTH : overlayWidth(side, windowWidth);
  const fullWidth = width >= windowWidth;

  return {
    width,
    isSidebar,
    paddingTop: insets.top,
    paddingLeft: side === 'left' || fullWidth ? insets.left : 0,
    paddingRight: side === 'right' || fullWidth ? insets.right : 0,
    // Swipes start anywhere on the screen, not just near the edge.
    swipeEdgeWidth: windowWidth,
  };
};
