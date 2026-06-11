import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { mockNavigate } from 'jest/mock/node-modules';

import { NoModelSelectedScreen } from '../NoModelSelectedScreen';

beforeEach(() => {
  mockNavigate.mockClear();
});

test('renders correctly NoModelSelectedScreen', () => {
  const tree = render(<NoModelSelectedScreen />).toJSON();
  expect(tree).toMatchSnapshot();
});

test('pressing the button opens the ModelsScreen', () => {
  const screen = render(<NoModelSelectedScreen />);

  fireEvent.press(
    screen.UNSAFE_getByProps({ title: 'screens.noModelSelected.selectModel' }),
  );

  expect(mockNavigate).toHaveBeenCalledWith('ModelsScreen');
});
