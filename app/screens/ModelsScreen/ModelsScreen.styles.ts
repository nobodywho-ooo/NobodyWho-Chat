import { StyleSheet } from 'react-native';
import { Layout, Spacings } from 'style';

export default StyleSheet.create({
  container: {
    ...Layout.container,
    paddingTop: Spacings.lg
  },
  text: {
    marginTop: Spacings.lg,
  },
});
