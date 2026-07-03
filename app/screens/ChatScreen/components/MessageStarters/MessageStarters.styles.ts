import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  list: {
    marginBottom: Spacings.sm,
  },
  listContent: {
    paddingHorizontal: Spacings.md,
    columnGap: Spacings.sm,
  },
  starterContainer: {
    paddingHorizontal: Spacings.lg,
    paddingVertical: Spacings.md,
    borderRadius: 16,
  },
  starterPressed: {
    opacity: 0.6,
  },
});
