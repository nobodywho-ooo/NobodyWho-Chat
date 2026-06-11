import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  listContainer: {
    flex: 1,
  },
  contentContainerStyle: {
    paddingTop: Spacings.xs,
  },
  header: {
    fontSize: Spacings.md,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacings.xl,
    marginBottom: Spacings.sm,
  },
  item: {
    paddingVertical: Spacings.md,
    paddingHorizontal: Spacings.md,
    borderRadius: Spacings.sm,
    marginHorizontal: Spacings.sm,
  },
  itemText: {
    fontSize: 15,
  },
  emptyText: {
    paddingHorizontal: Spacings.lg,
  },
});
