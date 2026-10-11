import { StyleSheet } from 'react-native';

import { Layout, Spacings } from 'style';

export default StyleSheet.create({
  progressContainer: {
    gap: Spacings.sm,
  },
  progressLabel: {
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: Spacings.xxl,
  },
  doneContainer: {
    ...Layout.container,
  },
  doneContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacings.md,
  },
  doneTitle: {
    fontWeight: '700',
    textAlign: 'center',
    marginTop: Spacings.md,
  },
  doneSubtitle: {
    textAlign: 'center',
  },
});
