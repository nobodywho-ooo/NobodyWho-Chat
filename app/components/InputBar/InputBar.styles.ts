import { StyleSheet } from 'react-native';

export const INPUT_BAR_HEIGHT = 48;

export const getBoxShadow = (shadowColor: string) => ({
  boxShadow: [
    {
      offsetX: 0,
      offsetY: 0,
      blurRadius: '15px' as const,
      spreadDistance: '4px' as const,
      color: shadowColor,
      inset: false,
    },
  ],
});

export const styles = StyleSheet.create({
  inputBarOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 12,
  },
  inputBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: INPUT_BAR_HEIGHT,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  sendButtonText: {
    fontSize: 16,
  },
});
