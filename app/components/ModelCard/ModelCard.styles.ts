import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacings.md,
    marginBottom: Spacings.sm,
    gap: Spacings.sm,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.md,
  },
  logoContainer: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: Spacings.sm,
  },
  headingContainer: {
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacings.xs,
  },
  pipelineLabel: {
    flex: 1,
  },
});
