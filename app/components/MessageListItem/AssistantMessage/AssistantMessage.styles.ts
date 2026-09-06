import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  assistantContainer: {
    marginVertical: Spacings.md,
    marginTop: Spacings.md,
  },
  streamdownContainer: {
    alignItems: 'flex-start',
  },
  footerContainer: {
    flexWrap: 'wrap',
    gap: Spacings.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacings.md,
  },
  buttonPressed: {
    opacity: 0.6,
  },
  metricsText: {
    lineHeight: 16,
    includeFontPadding: false,
  },
  loadingIndicator: {
    alignSelf: 'flex-start',
  },
});
