import { StyleSheet } from 'react-native';

import { Layout, Spacings } from 'style';

export default StyleSheet.create({
  container: {
    ...Layout.container,
  },
  content: {
    paddingTop: Spacings.lg,
  },
  sectionHeader: {
    paddingTop: Spacings.xl,
  },
  spinner: {
    alignSelf: 'center',
    paddingVertical: Spacings.xl,
  },
});
