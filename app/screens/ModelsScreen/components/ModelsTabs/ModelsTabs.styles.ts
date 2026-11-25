import { StyleSheet } from 'react-native';
import { CONTAINER_PADDING_HORIZONTAL, Spacings } from 'style';

export default StyleSheet.create({
  list: {
    flexGrow: 0,
    marginHorizontal: -CONTAINER_PADDING_HORIZONTAL,
  },
  listContent: {
    paddingHorizontal: CONTAINER_PADDING_HORIZONTAL,
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
