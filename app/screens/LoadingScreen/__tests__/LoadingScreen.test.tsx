import React from 'react';
import { render } from '@testing-library/react-native';

import { LoadingScreen } from '../LoadingScreen';

test('renders correctly LoadingScreen', async () => {
  const tree = (await render(<LoadingScreen />)).toJSON();
  expect(tree).toMatchSnapshot();
});
