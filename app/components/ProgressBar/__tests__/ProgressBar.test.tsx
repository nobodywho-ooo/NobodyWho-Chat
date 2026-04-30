import React from 'react';
import { render } from '@testing-library/react-native';

import { ProgressBar } from '../ProgressBar';

jest.unmock('../ProgressBar');

test('renders correctly ProgressBar', () => {
  const tree = render(<ProgressBar progress={0.3} />).toJSON();
  expect(tree).toMatchSnapshot();
});
