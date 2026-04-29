import { StyleSheet } from 'react-native';

import { Layout } from 'style';

export default StyleSheet.create({
  container: {
    ...Layout.container,
    paddingTop: 16,
  },
  spinner: {
    alignSelf: 'center',
    paddingVertical: 24,
  },
});
