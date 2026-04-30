import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  track: {
    height: Spacings.sm,
    borderRadius: Spacings.sm/2,
    marginTop: Spacings.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Spacings.sm/2,
  },
});
