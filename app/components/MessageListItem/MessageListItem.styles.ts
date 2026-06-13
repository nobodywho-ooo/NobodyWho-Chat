import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  userContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 12,
    maxWidth: '90%',
    alignSelf: 'flex-end',
    borderRadius: 16,
  },
  assistantContainer: {
    marginVertical: 12,
    marginTop: 10,
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
    marginTop: 6,
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
