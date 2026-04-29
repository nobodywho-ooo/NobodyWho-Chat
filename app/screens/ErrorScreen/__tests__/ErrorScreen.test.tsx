import React from 'react';
import { render } from '@testing-library/react-native';

import { ErrorScreen } from '../ErrorScreen';

test('renders correctly ErrorScreen', () => {
  const tree = render(<ErrorScreen onRetry={() => {}} />).toJSON();
  expect(tree).toMatchSnapshot();
});
