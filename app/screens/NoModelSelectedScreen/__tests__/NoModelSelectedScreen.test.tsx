import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { mockRouter } from 'jest/mock/node-modules';

import { NoModelSelectedScreen } from '../NoModelSelectedScreen';

beforeEach(() => {
  mockRouter.navigate.mockClear();
});

test('renders correctly NoModelSelectedScreen', async () => {
  const tree = (await render(<NoModelSelectedScreen />)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('pressing the button opens Models', async () => {
  const screen = await render(<NoModelSelectedScreen />);

  const [button] = screen.container.queryAll(
    node => node.props.title === 'screens.noModelSelected.selectModel',
  );
  await fireEvent.press(button);

  expect(mockRouter.navigate).toHaveBeenCalledWith('/models');
});
