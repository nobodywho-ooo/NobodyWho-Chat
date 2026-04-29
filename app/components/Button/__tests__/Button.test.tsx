import React from 'react';
import { render } from '@testing-library/react-native';

import { Button } from '../Button';

jest.unmock('../Button');

test('renders correctly Button', () => {
  const tree = render(<Button title="Some title" />).toJSON();
  expect(tree).toMatchSnapshot();
});
