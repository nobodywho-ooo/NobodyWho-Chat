import { StyleSheet } from 'react-native';

import { Layout, Spacings } from 'style';

export default StyleSheet.create({
  container: {
    ...Layout.container,
  },
  content: {
    paddingTop: Spacings.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.md,
    paddingVertical: Spacings.md,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: 14,
    marginTop: Spacings.xxs,
  },
  checkmark: {
    width: 20,
  },
});
