import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.sm,
    paddingTop: Spacings.lg,
    marginVertical: Spacings.md,
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacings.sm,
    marginBottom: Spacings.md,
  },
  loader: {
    marginTop: Spacings.lg,
  },
});
