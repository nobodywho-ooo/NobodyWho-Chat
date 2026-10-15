import { StyleSheet } from 'react-native';

import { Layout, Spacings } from 'style';

export default StyleSheet.create({
  container: {
    ...Layout.container,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Takes the free space above the step, pushing it to the bottom edge; once
  // the step overflows, it shrinks to the header's own padded height.
  headerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: Spacings.xxl,
  },
  header: {
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    paddingTop: Spacings.sm,
    paddingBottom: Spacings.xxl,
  },
});
