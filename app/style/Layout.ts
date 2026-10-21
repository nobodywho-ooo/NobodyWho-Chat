import { StyleSheet } from 'react-native';

import { Spacings } from './Spacings';

export const CONTAINER_PADDING_HORIZONTAL = Spacings.lg;
export const CONTENT_MAX_WIDTH = 560;
// Wider than any phone (440 pt) and a foldable's cover display (466 pt), where
// drawers stay full width; caps them on wide windows like the unfolded display.
export const DRAWER_MAX_WIDTH = 480;

export default StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: CONTAINER_PADDING_HORIZONTAL,
  },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
});
