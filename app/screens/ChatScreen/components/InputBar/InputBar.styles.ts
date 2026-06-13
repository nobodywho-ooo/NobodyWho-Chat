import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export const INPUT_BAR_HEIGHT = 42;

export const styles = StyleSheet.create({
  mainContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: Spacings.xs,
    paddingHorizontal: Spacings.md,
  },
  inputBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: Spacings.lg,
    paddingVertical: Spacings.sm,
    minHeight: INPUT_BAR_HEIGHT,
  },
  textInput: {
    flex: 1,
    paddingTop: -Spacings.xs,
    fontSize: 16,
    maxHeight: 100,
    paddingRight: 6,
  }
});
