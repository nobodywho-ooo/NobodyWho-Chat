import React from 'react';
import { render } from '@testing-library/react-native';

import { NoModelDownloadedScreen } from '../NoModelDownloadedScreen';

test('renders correctly NoModelDownloadedScreen', async () => {
  const tree = (await render(<NoModelDownloadedScreen />)).toJSON();
  expect(tree).toMatchSnapshot();
});
