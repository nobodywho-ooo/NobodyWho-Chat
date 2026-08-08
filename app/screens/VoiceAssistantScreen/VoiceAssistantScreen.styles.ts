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
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacings.xxl,
    gap: Spacings.md,
  },
  bodyTitle: {
    textAlign: 'center',
    marginTop: Spacings.sm,
  },
  bodyText: {
    textAlign: 'center',
  },
});
