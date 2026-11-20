import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { DotMatrixLoadingScreen } from '../DotMatrixLoadingScreen';

test('renders correctly DotMatrixLoadingScreen', async () => {
  const tree = (await render(<DotMatrixLoadingScreen />)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders the dot matrix and the message', async () => {
  await render(<DotMatrixLoadingScreen message="Loading…" />);
  expect(screen.getByTestId('dot-matrix-loader')).toBeTruthy();
  expect(screen.getByText('Loading…')).toBeTruthy();
});
