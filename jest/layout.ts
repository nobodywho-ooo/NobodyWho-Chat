import { fireEvent } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { View } from 'react-native';

interface LayoutQueryable {
  UNSAFE_getAllByType: (type: typeof View) => ReactTestInstance[];
}

/**
 * jsdom never lays components out, so `onLayout` never fires on its own. The
 * ChatScreen container measures its height that way before it can show the
 * empty state, so simulate that first layout pass.
 */
export const fireContainerLayout = (
  screen: LayoutQueryable,
  height = 812,
): void => {
  const container = screen
    .UNSAFE_getAllByType(View)
    .find(node => typeof node.props.onLayout === 'function');
  if (!container) {
    throw new Error('fireContainerLayout: no element with onLayout is mounted');
  }
  fireEvent(container, 'layout', {
    nativeEvent: { layout: { height, width: 375 } },
  });
};
