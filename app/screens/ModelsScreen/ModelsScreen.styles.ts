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
  secondHeader: {
    marginVertical: Spacings.lg,
  },
  loader: {
    marginTop: Spacings.lg,
  },
});
