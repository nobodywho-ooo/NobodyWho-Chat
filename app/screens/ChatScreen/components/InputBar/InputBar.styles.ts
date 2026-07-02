import { Platform, StyleSheet } from 'react-native';
import { Spacings } from 'style';

export const INPUT_BAR_HEIGHT = 42;
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
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: Spacings.lg,
    paddingVertical: Spacings.sm,
    minHeight: INPUT_BAR_HEIGHT,
  },
  textInput: {
    flex: 1,
    paddingTop: Platform.select({
      ios: -Spacings.xs,
      android: 8,
    }),
    fontSize: 16,
    maxHeight: 100,
    paddingRight: 6,
  },
  attachContainer: {
    marginRight: Spacings.sm
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
