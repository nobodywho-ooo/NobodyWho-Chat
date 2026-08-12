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
  micContainer: {
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
  setupContainer: {
    alignItems: 'center',
    gap: Spacings.md,
    paddingHorizontal: Spacings.md,
  },
  setupTitle: {
    textAlign: 'center',
  },
  setupDescription: {
    textAlign: 'center',
  },
  setupChecklistContainer: {
    gap: Spacings.sm,
    marginTop: Spacings.sm,
  },
  setupRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.sm,
  },
  setupHint: {
    textAlign: 'center',
    marginTop: Spacings.sm,
  },
  emptyContainerStyle: { 
    width: 40 
  } 
});
