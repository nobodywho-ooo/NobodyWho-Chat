import React from 'react';
import { render } from '@testing-library/react-native';

import { DrawerContentScreen } from '../DrawerContentScreen';

test('renders correctly DrawerContentScreen', () => {
  const tree = render(
    <DrawerContentScreen onCloseDrawer={() => {}} />,
  ).toJSON();
  expect(tree).toMatchSnapshot();
});
