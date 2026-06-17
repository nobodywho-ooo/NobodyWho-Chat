import { StyleSheet } from 'react-native';
import { Layout, Spacings } from 'style';

export default StyleSheet.create({
  container: {
    ...Layout.container,
    paddingTop: Spacings.lg,
  },
  firstHeader: {
    marginBottom: Spacings.lg,
  },
  header: {
    paddingTop: Spacings.lg,
    marginVertical: Spacings.md,
  },
  loader: {
    marginTop: Spacings.lg,
  },
});
