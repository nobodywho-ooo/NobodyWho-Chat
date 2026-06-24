import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacings.xl,
    paddingTop: Spacings.lg,
    paddingBottom: Spacings.md,
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacings.xl,
    gap: Spacings.sm,
    paddingTop: Spacings.lg,
    paddingBottom: Spacings.xxl,
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // TODO: height should be calculated
    height: 140,
    borderRadius: Spacings.xxxl,
  },
  floatingButton: {
    position: 'absolute',
    bottom: Spacings.xxl,
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
