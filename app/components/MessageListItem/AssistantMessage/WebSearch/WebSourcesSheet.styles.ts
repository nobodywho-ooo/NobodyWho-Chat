import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

import { SHEET_CLOSE_BUTTON_CLEARANCE } from '../../../Sheet/Sheet';

const PRESSED_OPACITY = 0.6;

export default StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacings.sm,
    paddingLeft: Spacings.lg,
    paddingRight: SHEET_CLOSE_BUTTON_CLEARANCE,
    paddingTop: Spacings.xl,
    paddingBottom: Spacings.md,
  },
  scrollContainer: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: Spacings.lg,
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.md,
    paddingVertical: Spacings.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressedContainer: {
    opacity: PRESSED_OPACITY,
  },
  faviconContainer: {
    width: 36,
    height: 36,
    borderRadius: Spacings.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextContainer: {
    flex: 1,
    gap: Spacings.xxs,
  },
});
