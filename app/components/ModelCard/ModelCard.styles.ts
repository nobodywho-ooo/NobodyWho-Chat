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
  },
  infoContainer: {
    paddingLeft: Spacings.md,
    flex: 1,
  },
  infoContainerNoIcon: {
    flex: 1,
  },
  detailsContainer: {
    flexDirection: 'row', 
    justifyContent: 'space-between',
    marginBottom: Spacings.sm,
  },
  name: {
    flex: 1,
    marginRight: Spacings.sm,
  },
  tags: {
    flexDirection: 'row',
    gap: Spacings.xs,
  },
  tag: {
    borderRadius: 6,
    paddingHorizontal: Spacings.sm,
    paddingVertical: Spacings.xxs,
  },
  tagText: {
    fontSize: 12,
  },
  metaData: {
    fontSize: 13,
  },
});
