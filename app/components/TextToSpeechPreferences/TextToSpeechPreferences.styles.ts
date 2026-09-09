import { StyleSheet } from 'react-native';

import { Spacings } from 'style';

export default StyleSheet.create({
  blockHeader: {
    paddingTop: Spacings.xxl,
  },
  sectionHeader: {
    paddingTop: Spacings.xl,
    paddingBottom: Spacings.xs,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacings.sm,
    paddingTop: Spacings.md,
  },
});
