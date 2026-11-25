import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacings.md,
  },
  content: {
    flex: 1,
  },
  contentAfterIcon: {
    marginLeft: Spacings.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  chevron: {
    marginLeft: 8,
  },
  disabled: {
    opacity: 0.4,
  },
});
