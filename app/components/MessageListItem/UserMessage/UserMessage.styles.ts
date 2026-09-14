import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export const LINE_HEIGHT = 22;
export const BUBBLE_PADDING_VERTICAL = Spacings.md;
export const ROW_MARGIN_VERTICAL = Spacings.md;

export default StyleSheet.create({
  userContainer: {
    marginVertical: ROW_MARGIN_VERTICAL,
    maxWidth: '90%',
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  userBubbleContainer: {
    paddingHorizontal: Spacings.lg,
    paddingVertical: BUBBLE_PADDING_VERTICAL,
    borderRadius: 16,
  },
  userBubblePressed: {
    opacity: 0.6,
  },
  text: {
    fontSize: 15,
    lineHeight: LINE_HEIGHT,
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
});
