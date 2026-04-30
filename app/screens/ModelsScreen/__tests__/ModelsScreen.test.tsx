import React from 'react';
import { render } from '@testing-library/react-native';

import { ModelsScreen } from '../ModelsScreen';

test('renders correctly ModelsScreen', () => {
  const tree = render(<ModelsScreen />).toJSON();
  expect(tree).toMatchSnapshot();
});
