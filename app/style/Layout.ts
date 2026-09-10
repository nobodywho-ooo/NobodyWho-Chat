import { StyleSheet } from 'react-native';

import { Spacings } from './Spacings';

export const CONTAINER_PADDING_HORIZONTAL = Spacings.lg;

export default StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: CONTAINER_PADDING_HORIZONTAL,
  },
});
