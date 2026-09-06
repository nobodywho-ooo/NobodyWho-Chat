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
  bodyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacings.xxl,
    gap: Spacings.xl,
  },
  captionsContainer: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.sm,
  },
  statusText: {
    textAlign: 'center',
  },
  actionContainer: {
    alignItems: 'center',
    paddingBottom: Spacings.xxxxl,
  },
  buttonContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainerStyle: {
    width: 40,
  },
});
