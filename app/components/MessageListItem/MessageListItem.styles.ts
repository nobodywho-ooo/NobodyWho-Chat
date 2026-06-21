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
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacings.sm,
    paddingHorizontal: Spacings.md,
    paddingVertical: Spacings.sm,
    borderRadius: 12,
    borderWidth: 1,
  },
  audioPlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPlayButtonPressed: {
    opacity: 0.6,
  },
});
