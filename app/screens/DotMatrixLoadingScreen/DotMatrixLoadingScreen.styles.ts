import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    marginTop: Spacings.xl,
    textAlign: 'center',
    paddingHorizontal: Spacings.xl,
  },
});
