import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingTop: Spacings.lg,
    columnGap: Spacings.sm,
  },
  pill: {
    paddingVertical: Spacings.sm + Spacings.xxs,
    paddingHorizontal: Spacings.lg,
    borderRadius: 999,
  },
  pressed: {
    opacity: 0.7,
  },
});
