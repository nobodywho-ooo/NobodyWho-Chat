import { StyleSheet } from 'react-native';

import { Layout, Spacings } from 'style';

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
  emptyChatContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: Spacings.md,
  },
});
