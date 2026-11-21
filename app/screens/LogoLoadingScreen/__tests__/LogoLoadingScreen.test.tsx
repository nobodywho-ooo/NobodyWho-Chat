import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { LogoLoadingScreen } from '../LogoLoadingScreen';

test('renders correctly LogoLoadingScreen', async () => {
  const tree = (await render(<LogoLoadingScreen />)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders the logo and its five dots', async () => {
  await render(<LogoLoadingScreen />);
  const frame = screen.getByTestId('logo-loading');
  expect(frame.queryAll(node => node.type === 'SvgMock')).toHaveLength(6);
});
