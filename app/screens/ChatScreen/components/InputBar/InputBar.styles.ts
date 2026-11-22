import { StyleSheet } from 'react-native';
import { iconButtonSize } from 'components';
import { Spacings } from 'style';

const TOP_GRADIENT_HEIGHT = 10;
const BOTTOM_FADE_HEIGHT = 64;
const CARD_RADIUS = 16;
const MARGIN_RIGHT_ICON_BUTTON = Spacings.sm;

export const BAR_BUTTON_SIZE = iconButtonSize(true);

export const styles = StyleSheet.create({
  mainContainer: {
    left: 0,
    right: 0,
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
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BOTTOM_FADE_HEIGHT,
  },
  opaqueCard: {
    borderWidth: 1,
  },
  glassCard: {
    borderRadius: CARD_RADIUS,
    borderCurve: 'continuous',
  },
  inputBarContainer: {
    flexDirection: 'column',
    borderRadius: CARD_RADIUS,
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
    paddingTop: Spacings.sm,
    paddingVertical: Spacings.lg,
    fontSize: 16,
    maxHeight: 100,
    paddingRight: 6,
  },
  iconButtonSpacing: {
    marginRight: MARGIN_RIGHT_ICON_BUTTON,
  },
  transcriptionLoaderContainer: {
    width: BAR_BUTTON_SIZE,
    height: BAR_BUTTON_SIZE,
    marginRight: MARGIN_RIGHT_ICON_BUTTON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachMainContainer: {
    flexDirection: 'row',
    alignSelf: 'center',
  },
  attachOptionsList: {
    alignSelf: 'flex-start',
    borderRadius: CARD_RADIUS,
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
