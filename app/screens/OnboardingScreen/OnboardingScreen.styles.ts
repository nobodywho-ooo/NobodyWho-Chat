import { StyleSheet } from 'react-native';

import { Layout, Spacings } from 'style';

export default StyleSheet.create({
  container: {
    ...Layout.container,
    justifyContent: 'space-between',
  },
  header: {
    fontWeight: '700',
    textAlign: 'center',
    paddingTop: Spacings.xxxl,
  },
  subtitle: {
    paddingTop: Spacings.sm,
    paddingBottom: Spacings.xxl,
  },
  choicesContainer: {
    gap: Spacings.md,
  },
  progressContainer: {
    gap: Spacings.sm,
  },
  progressLabel: {
    textAlign: 'center',
  },
  secondaryButton: {
    marginTop: Spacings.xxxl,
  },
});
