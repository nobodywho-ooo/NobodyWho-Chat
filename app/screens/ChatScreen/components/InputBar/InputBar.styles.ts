import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export const INPUT_BAR_HEIGHT = 94;
const TOP_GRADIENT_HEIGHT = 10;

export const styles = StyleSheet.create({
  mainContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  inputFieldContainer: {
    paddingTop: Spacings.xs,
    paddingHorizontal: Spacings.md,
  },
  topGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -TOP_GRADIENT_HEIGHT,
    height: TOP_GRADIENT_HEIGHT,
  },
  inputBarContainer: {
    flexDirection: 'column',
    borderRadius: 16,
    paddingHorizontal: Spacings.lg,
    paddingVertical: Spacings.sm,
  },
  inputBarContainerBottomPart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: Spacings.sm,
  },
  inputBarContainerBottomPartLeft: {
    flexDirection: 'row',
  },
  textInput: {
    flex: 1,
    paddingTop: Spacings.sm,
    paddingVertical: Spacings.lg,
    fontSize: 16,
    maxHeight: 100,
    paddingRight: 6,
  },
  attachContainer: {
    marginRight: Spacings.sm
  },
  transcriptionContainer: {
    marginRight: Spacings.sm,
  },
  transcriptionLoaderContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachMainContainer: {
    flexDirection: 'row',
    alignSelf: 'center',
  },
  attachOptionsList: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    paddingHorizontal: Spacings.lg,
    paddingVertical: Spacings.md,
    rowGap: Spacings.md,
    marginBottom: Spacings.sm,
    marginHorizontal: Spacings.md,
  },
  attachOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachLabel: {
    marginLeft: Spacings.xs,
  },
});
