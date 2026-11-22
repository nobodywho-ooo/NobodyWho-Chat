import { StyleSheet } from 'react-native';

import { Layout, Spacings } from 'style';

export default StyleSheet.create({
  container: {
    ...Layout.container,
  },
  content: {
    paddingTop: Spacings.lg,
  },
  heading: {
    paddingBottom: Spacings.sm,
  },
  sectionHeader: {
    paddingTop: Spacings.xxl,
  },
  spinner: {
    alignSelf: 'center',
    paddingVertical: Spacings.xl,
  },
});
