import { StyleSheet } from 'react-native';

import { Layout, Spacings } from 'style';

export default StyleSheet.create({
  container: {
    ...Layout.container,
    paddingTop: Spacings.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    paddingTop: Spacings.xxl,
    paddingBottom: Spacings.lg,
    textAlign: 'center',
  },
  progressContainer: {
    alignSelf: 'stretch',
    gap: Spacings.sm,
  },
  progressLabel: {
    textAlign: 'center',
  },
  buttonsContainer: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: Spacings.xl,
    gap: Spacings.md,
  },
  hint: {
    textAlign: 'center',
    paddingTop: Spacings.lg,
    paddingBottom: Spacings.xl,
  },
});
