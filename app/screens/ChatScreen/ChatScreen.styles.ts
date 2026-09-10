import { StyleSheet } from 'react-native';

import { CONTAINER_PADDING_HORIZONTAL, Layout, Spacings } from 'style';

export default StyleSheet.create({
  container: {
    ...Layout.container,
  },
  dismissOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  blurFill: {
    flex: 1,
  },
  blurTargetContainer: {
    flex: 1,
    marginHorizontal: -CONTAINER_PADDING_HORIZONTAL,
  },
  blurTargetContent: {
    flex: 1,
    paddingHorizontal: CONTAINER_PADDING_HORIZONTAL,
  },
  headerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 10,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: Spacings.md,
  },
  emptyArea: {
    flex: 1,
  },
});
