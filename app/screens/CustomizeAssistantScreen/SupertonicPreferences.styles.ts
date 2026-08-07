import { StyleSheet } from 'react-native';

import { Spacings } from 'style';

export default StyleSheet.create({
  sectionHeader: {
    paddingTop: Spacings.xl,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacings.sm,
    paddingTop: Spacings.md,
  },
});
