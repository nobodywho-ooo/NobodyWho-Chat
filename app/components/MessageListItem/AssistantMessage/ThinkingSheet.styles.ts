import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  title: {
    paddingHorizontal: Spacings.lg,
    paddingVertical: Spacings.md,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacings.lg,
  },
  content: {
    alignItems: 'flex-start',
  },
});
