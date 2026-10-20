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
    gap: Spacings.xxs,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.sm,
  },
  title: {
    flexShrink: 1,
  },
  smallTitle: {
    fontWeight: '500',
  },
  sizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.xs,
  },
  tagsContainer: {
    marginTop: Spacings.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacings.xs,
  },
});
