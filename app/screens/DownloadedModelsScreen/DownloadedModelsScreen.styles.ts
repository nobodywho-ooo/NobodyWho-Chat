import { StyleSheet } from 'react-native';
import { Layout, Spacings } from 'style';

export default StyleSheet.create({
  container: {
    ...Layout.container,
    paddingTop: Spacings.lg,
  },
  sectionContainer: {
    paddingBottom: Spacings.lg,
  },
  sectionTitle: {
    paddingBottom: Spacings.sm,
  },
  noModelContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noModelContainerText: {
    paddingBottom: Spacings.lg,
  },
  headerActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.xl,
    paddingHorizontal: Spacings.lg,
  },
});
