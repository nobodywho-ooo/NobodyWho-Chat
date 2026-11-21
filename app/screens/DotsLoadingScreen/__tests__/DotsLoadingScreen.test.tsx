import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { DotsLoadingScreen } from '../DotsLoadingScreen';

test('renders correctly DotsLoadingScreen', async () => {
  const tree = (await render(<DotsLoadingScreen />)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders the three dots', async () => {
  await render(<DotsLoadingScreen />);
  expect(screen.getByTestId('bouncing-dots')).toBeTruthy();
});
