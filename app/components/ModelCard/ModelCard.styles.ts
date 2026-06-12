import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacings.md,
    marginBottom: Spacings.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.md,
  },
  infoContainer: {
    flex: 1,
    gap: Spacings.xs,
  },
  pipeline: {
    fontSize: 13,
  },
  tagsContainer: {
    marginTop: Spacings.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacings.xs,
  },
});
