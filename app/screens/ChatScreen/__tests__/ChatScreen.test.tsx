import React from 'react';
import { render } from '@testing-library/react-native';

import { ChatScreen } from '../ChatScreen';

test('renders correctly ChatScreen', () => {
  const tree = render(<ChatScreen />).toJSON();
  expect(tree).toMatchSnapshot();
});
