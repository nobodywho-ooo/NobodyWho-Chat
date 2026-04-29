import React from 'react';
import { render } from '@testing-library/react-native';

import { LoadingScreen } from '../LoadingScreen';

test('renders correctly LoadingScreen', () => {
  const tree = render(<LoadingScreen />).toJSON();
  expect(tree).toMatchSnapshot();
});
