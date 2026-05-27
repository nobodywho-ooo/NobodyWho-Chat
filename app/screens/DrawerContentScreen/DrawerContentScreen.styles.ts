import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacings.xl,
    paddingTop: Spacings.lg,
    paddingBottom: Spacings.md,
  },
  actions: {
    paddingHorizontal: Spacings.xl,
    gap: Spacings.sm,
    paddingBottom: Spacings.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: Spacings.md,
    paddingHorizontal: Spacings.lg,
    borderRadius: Spacings.md,
    gap: Spacings.md,
  },
  actionLabel: {
    fontWeight: '500',
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
