import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

import { SHEET_CLOSE_BUTTON_CLEARANCE } from '../../Sheet/Sheet';

export default StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacings.xs,
    paddingLeft: Spacings.lg,
    paddingRight: SHEET_CLOSE_BUTTON_CLEARANCE,
    paddingTop: Spacings.xl,
    paddingBottom: Spacings.md,
  },
  title: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacings.lg,
    rowGap: Spacings.xs,
  },
  sectionLabel: {
    marginTop: Spacings.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  code: {
    fontFamily: 'Courier',
    fontSize: 13,
    lineHeight: 18,
  },
});
