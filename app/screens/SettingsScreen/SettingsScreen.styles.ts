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
  buttonsContainer: {
    marginTop: Spacings.xxxxl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacings.sm,
  },
  appName: {
    paddingTop: Spacings.xl,
  },
  appInfo: {
    paddingTop: Spacings.sm,
  },
  sectionHeader:{ 
    paddingTop: Spacings.xl
  }
});
