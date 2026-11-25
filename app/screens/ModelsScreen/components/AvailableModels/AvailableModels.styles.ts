import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacings.sm,
    paddingTop: Spacings.lg,
    marginTop: Spacings.md,
    marginBottom: Spacings.xl,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacings.xs,
    marginTop: Spacings.xs,
  },
  pressed: {
    opacity: 0.6,
  },
  loader: {
    marginTop: Spacings.lg,
  },
});
