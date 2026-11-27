import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSidebar } from 'navigation';
import { CONTENT_MAX_WIDTH, SIDEBAR_WIDTH, WIDE_CONTENT_RATIO } from 'style';

export interface ChatColumn {
  paddingLeft: number;
  paddingRight: number;
  insetLeft: number;
  insetRight: number;
}

export const chatColumn = ({
  areaWidth,
  insetLeft,
  insetRight,
}: {
  areaWidth: number;
  insetLeft: number;
  insetRight: number;
}): ChatColumn => {
  const available = Math.max(areaWidth - insetLeft - insetRight, 0);
  const width = Math.min(
    available,
    Math.max(CONTENT_MAX_WIDTH, Math.round(available * WIDE_CONTENT_RATIO)),
  );
  const gutter = (available - width) / 2;

  return {
    paddingLeft: insetLeft + gutter,
    paddingRight: insetRight + gutter,
    insetLeft,
    insetRight,
  };
};

// Where the chat's content goes across the window. Full width on phones; on
// wider windows a centred column (CONTENT_MAX_WIDTH, or WIDE_CONTENT_RATIO of
// the space). Each side keeps clear of its own safe-area inset — iPhone Duo's
// vertical bar is on one edge only — and the left one belongs to the sidebar
// while it is shown.
export const useChatColumn = (): ChatColumn => {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isSidebarShown } = useSidebar();

  const areaWidth = windowWidth - (isSidebarShown ? SIDEBAR_WIDTH : 0);
  const insetLeft = isSidebarShown ? 0 : insets.left;

  return useMemo(
    () => chatColumn({ areaWidth, insetLeft, insetRight: insets.right }),
    [areaWidth, insetLeft, insets.right],
  );
};
