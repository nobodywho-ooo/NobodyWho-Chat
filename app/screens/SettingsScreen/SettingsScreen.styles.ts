import { StyleSheet } from 'react-native';

import { Layout, Spacings } from 'style';

export default StyleSheet.create({
  container: {
    ...Layout.container,
    paddingTop: Spacings.lg,
  },
  spinner: {
    alignSelf: 'center',
    paddingVertical: Spacings.xl,
  },
  websiteButton: {
    alignSelf: 'center',
    marginTop: Spacings.xxxl,
  },
  appName: {
    paddingTop: Spacings.xl,
    alignSelf: 'center'
  },
  appInfo: {
    paddingTop: Spacings.sm,
    alignSelf: 'center'
  }
});
