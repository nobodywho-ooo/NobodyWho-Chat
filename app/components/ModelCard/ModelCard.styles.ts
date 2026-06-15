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
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.sm,
  },
  modelContainer: {
    flexShrink: 1,
  },
  pipelineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.xs,
  },
  tagsContainer: {
    marginTop: Spacings.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacings.xs,
  },
});
