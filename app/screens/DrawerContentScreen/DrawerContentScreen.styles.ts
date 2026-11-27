import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export const FLOATING_BUTTON_BOTTOM = Spacings.xxl;

// Where UIKit puts bar buttons in the closed iPhone Duo's rail (the chat's menu
// and more buttons), measured on the simulator: centred 48 pt from the right
// edge, the first 198 pt from the top, the next 60 pt below.
const RAIL_BUTTON_CENTER_FROM_RIGHT = 48;
export const RAIL_FIRST_BUTTON_CENTER = 198;
export const RAIL_BUTTON_PITCH = 60;

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacings.xl,
    paddingTop: Spacings.lg,
    paddingBottom: Spacings.md,
  },
  centeredTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.sm,
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacings.xl,
    gap: Spacings.sm,
    paddingTop: Spacings.lg,
    paddingBottom: Spacings.xxl,
  },
  railButtons: {
    position: 'absolute',
    right: 0,
    width: RAIL_BUTTON_CENTER_FROM_RIGHT * 2,
    alignItems: 'center',
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // TODO: height should be calculated
    height: 140,
    borderRadius: Spacings.xxxl,
  },
  floatingButton: {
    position: 'absolute',
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
