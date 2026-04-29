import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacings.lg,
    marginBottom: Spacings.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacings.xs,
  },
  name: {
    flex: 1,
    marginRight: Spacings.sm,
  },
  tags: {
    flexDirection: 'row',
    gap: Spacings.xs,
  },
  tag: {
    borderRadius: 6,
    paddingHorizontal: Spacings.sm,
    paddingVertical: Spacings.xxs,
  },
  tagText: {
    fontSize: 12,
  },
  meta: {
    fontSize: 13,
  },
});
