import React from 'react';
import { render } from '@testing-library/react-native';

import { NoModelDownloadedScreen } from '../NoModelDownloadedScreen';

test('renders correctly NoModelDownloadedScreen', () => {
  const tree = render(<NoModelDownloadedScreen />).toJSON();
  expect(tree).toMatchSnapshot();
});
