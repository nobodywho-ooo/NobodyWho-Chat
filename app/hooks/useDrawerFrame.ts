import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DRAWER_MAX_WIDTH } from 'style';

type Side = 'left' | 'right';

// Drawer geometry that follows the window, so it stays right when a foldable
// opens or closes mid-session (Dimensions.get() is read once and goes stale).
// Full width on phones, capped on wide windows. paddingLeft/paddingRight are
// the safe-area insets of the screen edges the drawer touches (in landscape
// the status bar is a column on the right edge): apply them to the drawer, or
// to its content when something must still bleed to the edge.
export const useDrawerFrame = (side: Side) => {
  const windowSize = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const width = Math.min(windowSize.width, DRAWER_MAX_WIDTH);
  const fullWidth = width >= windowSize.width;
  const touchesLeft = side === 'left' || fullWidth;
  const touchesRight = side === 'right' || fullWidth;

  return {
    width,
    paddingTop: insets.top,
    paddingLeft: touchesLeft ? insets.left : 0,
    paddingRight: touchesRight ? insets.right : 0,
    // Swipes start anywhere on the screen, not just near the edge.
    swipeEdgeWidth: windowSize.width,
  };
};
