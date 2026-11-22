import { useCallback, useEffect } from 'react';
import { type LayoutChangeEvent } from 'react-native';
import { useDrawerCoordination } from 'navigation';

// The bar's outer container holds everything it can grow to — the message
// starters, the attach options, the field itself — and it's pinned to the
// bottom of the screen (the keyboard inset arrives as its padding), so its
// height is exactly the strip the drawer swipes have to ignore. See
// DrawerCoordination. Returns the container's onLayout.
export const useDrawerSwipeExclusion = () => {
  const { reportSwipeExclusion } = useDrawerCoordination();

  useEffect(() => () => reportSwipeExclusion(0), [reportSwipeExclusion]);

  return useCallback(
    ({ nativeEvent }: LayoutChangeEvent) =>
      reportSwipeExclusion(nativeEvent.layout.height),
    [reportSwipeExclusion],
  );
};
