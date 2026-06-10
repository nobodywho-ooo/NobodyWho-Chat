import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { mockSetAppState } from 'jest/mock/database';
import { mockNavigate } from 'jest/mock/navigation';

import { DrawerContentScreen } from '../DrawerContentScreen';

beforeEach(() => {
  mockNavigate.mockClear();
  mockSetAppState.mockClear();
});

test('renders correctly DrawerContentScreen', () => {
  const tree = render(
    <DrawerContentScreen onCloseDrawer={() => {}} />,
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

test('pressing settings navigates to the SettingsScreen', () => {
  const screen = render(<DrawerContentScreen onCloseDrawer={jest.fn()} />);

  fireEvent.press(screen.getByText('screens.drawerContent.settings'));

  expect(mockNavigate).toHaveBeenCalledWith('SettingsScreen');
});

test('pressing new chat clears the conversation in use and closes the drawer', () => {
  const onCloseDrawer = jest.fn();
  const screen = render(<DrawerContentScreen onCloseDrawer={onCloseDrawer} />);

  fireEvent.press(
    screen.UNSAFE_getByProps({ title: 'screens.drawerContent.newChat' }),
  );

  expect(mockSetAppState).toHaveBeenCalledWith({
    conversationIdInUse: undefined,
  });
  expect(onCloseDrawer).toHaveBeenCalled();
});
