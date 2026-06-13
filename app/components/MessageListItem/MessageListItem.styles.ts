import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  userContainer: {
    paddingHorizontal: Spacings.lg,
    paddingVertical: Spacings.md,
    marginVertical: Spacings.md,
    maxWidth: '90%',
    alignSelf: 'flex-end',
    borderRadius: 16,
  },
  assistantContainer: {
    marginVertical: Spacings.md,
    marginTop: Spacings.md,
  },
  streamdownContainer: {
    alignItems: 'flex-start',
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: Spacings.md,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyButtonPressed: {
    opacity: 0.6,
  },
  copyLabel: {
    marginLeft: 4,
    lineHeight: 16,
    includeFontPadding: false,
  },
  metricsText: {
    marginLeft: 12,
    lineHeight: 16,
    includeFontPadding: false,
  },
});
