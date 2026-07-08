import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  userContainer: {
    marginVertical: Spacings.md,
    maxWidth: '90%',
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  userBubbleContainer: {
    paddingHorizontal: Spacings.lg,
    paddingVertical: Spacings.md,
    borderRadius: 16,
  },
  userBubblePressed: {
    opacity: 0.6,
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
  attachmentsContainer: {
    marginBottom: Spacings.sm,
    rowGap: Spacings.sm,
    alignItems: 'flex-start',
  },
  attachmentName: {
    lineHeight: 16,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacings.sm,
    rowGap: Spacings.sm,
    alignItems: 'flex-start',
  },
  audioContainer: {
    rowGap: Spacings.sm,
    alignSelf: 'stretch',
  },
  imageAttachment: {
    height: 60,
    width: 80,
    borderRadius: 8,
  },
  imagePressed: {
    opacity: 0.6,
  },
  loadingIndicator: {
    alignSelf: 'flex-start',
  }
});
